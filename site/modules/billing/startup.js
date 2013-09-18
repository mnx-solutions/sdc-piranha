'use strict';

var config = require('easy-config');
var moment = require('moment');
var restify = require('restify');
var zHelpers = require('./lib/zuora-helpers');

var isProduction = ['pro','production'].indexOf(config.getDefinedOptions().env) !== -1;

module.exports = function execute(scope, callback) {
    var options = config.zuora.api;
    options.log = scope.log;
    var zuora = require('zuora').create(options);

    var server = scope.api('Server');
    var SignupProgress = scope.api('SignupProgress');

    server.onCall('listPaymentMethods', function (call) {
        zHelpers.getPaymentMethods(call, call.done.bind(call));
    });

    server.onCall('defaultCreditCard', function (call) {
        zHelpers.getPaymentMethods(call, function (err, pms) {
            if (err) {
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

        function error(err, resp, msg) {
            call.log.error(msg || 'Failed to save to zuora', err, resp && resp.reasons);
            zHelpers.updateErrorList(scope, resp, function () {
                err.zuora = err.zuora || resp;
                call.done(err);
            });
        }

        call.log.debug('Checking if zuora account exists');
        zuora.account.get(call.req.session.userId, function (err, acc) {
            if (err) {
                if (zHelpers.notFound(acc)) {
                    call.log.debug('Creating new zuora account');

                    zHelpers.createZuoraAccount(call, function (err, data, user) {
                        if (err) {
                            error(err, data, 'Zuora account.create failed');
                            return;
                        }

                        //Set minimum progress to session and ask billing server to update
                        call.log.debug('Updating user progress');
                        call._user = user;

                        SignupProgress.setMinProgress(call, 'billing', function (err) {
                            if (err) {
                                call.log.error(err);
                            }

                            call.done(null, data);
                        });
                    });
                    return;
                }

                error(err, acc, 'Account check with zuora failed');
                return;
            }

            call.log.debug('Attempting to add cc to zuora');

            //Compose the creditcard object
            zHelpers.composeCreditCardObject(call, function (err, data) {
                if (err) {
                    error(err, data, 'CC failed local validation');
                    return;
                }

                // Create payment
                zuora.payment.create(data, function (err, resp) {
                    if (err) {
                        error(err, resp);
                        return;
                    }

                    call.log.debug('Zuora payment.create returned with', resp);
                    var count = 2;

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

    server.onCall('listInvoices', function (call) {
        zuora.transaction.getInvoices(call.req.session.userId, function (err, resp) {
            if (err) {
                call.done(err);
                return;
            }

            call.done(null, resp.invoices);
        });
    });

    server.onCall('getLastInvoice', function (call) {
        zuora.transaction.getInvoices(call.req.session.userId, function (err, resp) {
            if (err) {
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
                call.done(err);
                return;
            }

            call.done(null, resp.subscriptions);
        });
    });

    zHelpers.init(zuora, function (err, errType) {
        if (err) {
            if(errType === 'errors') {
                scope.log.fatal('Failed to load zuora errors file', err);
                process.exit();
            } else if(isProduction) {
                scope.log.fatal('Failed to connect soap', err);
                process.exit();
            } else {
                scope.log.error('Failed to connect soap', err);
            }
        }

        callback();
    });
};


