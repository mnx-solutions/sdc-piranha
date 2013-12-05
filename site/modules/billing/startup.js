'use strict';

var config = require('easy-config');
var moment = require('moment');
var zHelpers = require('./lib/zuora-helpers');

var isProduction = config.isProduction();

module.exports = function execute(scope, callback) {
    var options = config.extend(config.zuora.rest, {
        url: config.zuora.rest.endpoint,
        log: scope.log,
        password: config.zuora.password,
        user: config.zuora.user
    });

    var zuora = require('zuora').create(options);

    var server = scope.api('Server');
    var SignupProgress = scope.api('SignupProgress');
    var Metadata = scope.api('Metadata');
    var MaxMind = scope.api('MaxMind');

    server.onCall('listPaymentMethods', function (call) {
        zHelpers.getPaymentMethods(call, call.done.bind(call));
    });

    server.onCall('defaultCreditCard', function (call) {
        zHelpers.getPaymentMethods(call, function (err, pms) {
            if (err) {

                // changing zuoras errorCode from 401's to 500
                if(err.statusCode === 401) {
                    err.statusCode = 500;
                }

                call.done(err);
                return;
            }

            var def = {};
            if (pms.creditCards) {
                pms.creditCards.some(function (d) {
                    if (d.defaultPaymentMethod) {
                        def = d;
                        return true;
                    }
                });
            }
            call.done(null, def);
        });
    });

    // TODO: Some proper error logging
    server.onCall('addPaymentMethod', function (call) {
        call.log.debug('Calling addPaymentMethod');

        var serviceAttempts = call.req.session.zuoraServiceAttempt || 0;
        call.req.session.zuoraServiceAttempt = serviceAttempts + 1;

        function error(err, resp, msg) {
            // changing zuoras errorCode from 401's to 500
            if (err.statusCode === 401) {
                err.statusCode = 500;
            }

            var logObj = {
                err: err
            };

            if (resp && resp.reasons) {
                logObj.zuoraErr = resp.reasons;
            }

            var lvl = 'error';
            logObj.attempt = call.req.session.zuoraServiceAttempt;

            if((logObj.zuoraErr && logObj.zuoraErr.split && logObj.zuoraErr.split.field === '_general')
              || !err.statusCode) {
                lvl = 'info';
            }

            call.log[lvl](logObj, msg || 'Failed to save to zuora');

            zHelpers.updateErrorList(scope, resp, function () {
                err.zuora = err.zuora || resp;
                call.done(err, true);
            });
        }

        call.log.debug('Checking if zuora account exists');
        zuora.account.get(call.req.session.userId, function (err, acc) {
            if (err) {
                // changing zuoras errorCode from 401's to 500
                if(err.statusCode === 401) {
                    err.statusCode = 500;
                }
                if (!zHelpers.notFound(acc)) {
                    error(err, acc, 'Account check with zuora failed');
                    return;
                }

                call.log.debug('Creating new zuora account');

                zHelpers.createZuoraAccount(call, function (err, data, user) {
                    if (err) {
                        // changing zuoras errorCode from 401's to 500
                        if(err.statusCode === 401) {
                            err.statusCode = 500;
                        }
                        error(err, data, 'Zuora account.create failed');
                        return;
                    }
                    call.session(function (req) {
                        req.session.zuoraServiceAttempt = 0;
                    });

                    //Set minimum progress to session and ask billing server to update
                    call.log.debug('Updating user progress');
                    call._user = user;

                    SignupProgress.setMinProgress(call, 'billing', function (err) {
                        if (err) {
                            call.log.error(err);
                        }

                        MaxMind.minFraud(call, user, call.req.body.data.cardHolderInfo, call.req.body.data, function (fraudErr, result) {
                            if (fraudErr) {
                                fraudErr.attempt = call.req.session.zuoraServiceAttempt;

                                call.log.error(fraudErr);
                                call.done(fraudErr);
                                return;
                            }

                            if (result.riskScore) {
                                call.log.info('Saving user riskScore in metadata');
                                Metadata.set(call.req.session.userId, Metadata.RISK_SCORE, result.riskScore);
                            }

                            if (result.block) {
                                if (result.blockReason) {
                                    Metadata.set(call.req.session.userId, Metadata.BLOCK_REASON, result.blockReason);
                                }

                                SignupProgress.setSignupStep(call, 'blocked', function (blockErr) {
                                    if (blockErr) {
                                        call.log.error(blockErr);
                                    }

                                    call.req.session.zuoraServiceAttempt = 0;
                                    call.done(null, data);
                                });
                                return;
                            }
                            call.done(null, data);
                        });

                    });
                });
                return;
            }

            call.log.debug('Attempting to add cc to zuora');

            //Compose the creditcard object
            zHelpers.composeCreditCardObject(call, function (err, data) {
                if (err) {
                    // changing zuoras errorCode from 401's to 500
                    if(err.statusCode === 401) {
                        err.statusCode = 500;
                    }
                    error(err, data, 'CC failed local validation');
                    return;
                }

                // Create payment
                zuora.payment.create(data, function (err, resp) {
                    if (err) {
                        // changing zuoras errorCode from 401's to 500
                        if(err.statusCode === 401) {
                            err.statusCode = 500;
                        }
                        error(err, resp);
                        return;
                    }

                    call.log.debug('Zuora payment.create returned with', resp);
                    var count = 3;

                    call.session(function (req) {
                        req.session.zuoraServiceAttempt = 0;
                    });

                    SignupProgress.safeSetSignupStep(call, 'billing', function (setErr) {
                        if (setErr) {
                            call.log.error(setErr, 'Failed to update signupStep');
                        }
                        if (--count === 0) {
                            call.done(null, resp);
                        }
                    });

                    // Payment method added
                    // Have to remove previous billing methods.
                    zHelpers.deleteAllButDefaultPaymentMethods(call, function (err) {
                        //Ignoring errors
                        if (--count === 0) {
                            call.done(null, resp);
                        }
                    });

                    // Check if we need to update account info
                    zHelpers.composeBillToContact(call, function (err, billToContact) {
                        if (err) { // Ignore errors here
                            if (--count === 0) {
                                call.done(null, resp);
                            }
                            return;
                        }

                        var same = zHelpers.compareBillToContacts(acc.basicInfo.billToContact, billToContact);
                        if (!same) { // Have to update
                            var obj = {
                                billToContact: billToContact,
                                soldToContact: billToContact
                            };

                            zuora.account.update(call.req.session.userId, obj, function (err, res) {
                                // Ignoring errors here
                                if (--count === 0) {
                                    call.done(null, resp);
                                }
                            });
                            return;
                        }

                        if (--count === 0) {
                            call.done(null, resp);
                        }
                    });
                });
            });
        });
    });

    if(config.features.invoices !== 'disabled') {
        server.onCall('listInvoices', function (call) {
            zuora.transaction.getInvoices(call.req.session.userId, function (err, resp) {
                if (err) {
                    // changing zuoras errorCode from 401's to 500
                    if(err.statusCode === 401) {
                        err.statusCode = 500;
                    }
                    call.done(err);
                    return;
                }

                call.done(null, resp.invoices);
            });
        });

        server.onCall('getLastInvoice', function (call) {
            zuora.transaction.getInvoices(call.req.session.userId, function (err, resp) {
                if (err) {
                    // changing zuoras errorCode from 401's to 500
                    if(err.statusCode === 401) {
                        err.statusCode = 500;
                    }
                    call.done(err);
                    return;
                }

                if (!resp.invoices.length) {
                    call.done(null, null);
                    return;
                }

                resp.invoices.sort(function (a, b) {
                    return moment(b.invoiceDate).unix() - moment(a.invoiceDate).unix();
                });

                call.done(null, resp.invoices[0]);
            });
        });

        server.onCall('getSubscriptions', function (call) {
            zuora.subscription.getByAccount(call.req.session.userId, function (err, resp) {
                if (err) {
                    // changing zuoras errorCode from 401's to 500
                    if(err.statusCode === 401) {
                        err.statusCode = 500;
                    }

                    call.done(err);
                    return;
                }

                call.done(null, resp.subscriptions);
            });
        });
    }

    zHelpers.init(zuora, function (err, errType) {
        callback();
    });
};


