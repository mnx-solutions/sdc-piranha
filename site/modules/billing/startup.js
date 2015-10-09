'use strict';

var config = require('easy-config');
if (config.features && config.features.billing === 'disabled') {
    return;
}
var moment = require('moment');
var zHelpers = require('./lib/zuora-helpers');

module.exports = function execute(log, config) {
    var options = config.extend(config.zuora.rest, {
        url: config.zuora.rest.endpoint,
        log: log,
        password: config.zuora.password,
        user: config.zuora.user
    });

    var zuora = require('zuora-rest').create(options);

    var server = require('../server').Server;
    var Metadata = require('../account').Metadata;
    var SignupProgress = require('../account').SignupProgress;
    var MaxMind = require('../maxmind').MaxMind;

    server.onCall('listPaymentMethods', function (call) {
        zHelpers.getPaymentMethods(call, call.done.bind(call));
    });

    server.onCall('defaultCreditCard', function (call) {
        zHelpers.getPaymentMethods(call, function (err, pms) {
            if (err) {

                // changing zuoras errorCode from 401's to 500
                if (err.statusCode === 401) {
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
                    return false;
                });
            }
            call.done(null, def);
        });
    });

    function performFraudValidation(call, email, fraudCallback) {
        SignupProgress.setMinProgress(call, 'billing', function (err) {
            if (err) {
                call.log.error(err);
            }

            MaxMind.minFraud(call, email, call.req.body.data.cardHolderInfo, call.req.body.data, function (fraudErr, result) {
                if (fraudErr) {
                    fraudErr.attempt = call.req.session.zuoraServiceAttempt;

                    call.log.error(fraudErr);
                    fraudCallback(fraudErr);
                    return;
                }

                if (result.riskScore) {
                    call.log.info('Saving user risk score in metadata');
                    Metadata.set(call.req.session.userId, Metadata.RISK_SCORE, result.riskScore, function (setErr) {
                        if (setErr) {
                            call.log.error({error: setErr}, 'Saving user risk score in metadata failed');
                        }
                    });
                }

                if (result.explanation) {
                    call.log.info('Saving user risk explanation in metadata');
                    Metadata.set(call.req.session.userId, Metadata.RISK_SCORE_EXPLANATION, result.explanation, function (setErr) {
                        if (setErr) {
                            call.log.error({error: setErr}, 'Saving user risk explanation in metadata failed');
                        }
                    });
                }

                if (result.block) {
                    if (result.blockReason) {
                        Metadata.set(call.req.session.userId, Metadata.BLOCK_REASON, result.blockReason, function (setErr) {
                            if (setErr) {
                                call.log.error({error: setErr}, 'Saving user block reason in metadata failed');
                            }
                        });
                    }

                    SignupProgress.setSignupStep(call, 'blocked', function (blockErr) {
                        if (blockErr) {
                            call.log.error(blockErr);
                        }

                        call.req.session.zuoraServiceAttempt = 0;
                        call.req.session.save();
                        fraudCallback('User blocked');
                    });
                    return;
                }
                fraudCallback(null);
            });

        });
    }

    function zuoraError(call, err, resp, msg) {
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

        if ((logObj.zuoraErr && logObj.zuoraErr.split && logObj.zuoraErr.split.field === '_general') || !err.statusCode) {
            lvl = 'info';
        }

        call.log[lvl](logObj, msg || 'Failed to save to zuora');

        zHelpers.updateErrorList(log, resp, function () {
            err.zuora = err.zuora || resp;
            call.done(err, true);
        });
    }

    var addOrUpdatePaymentMethod = function (call, acc) {
        var clearPaymentMethods = function (paymentMethodResponse) {
            var count = 3;

            call.session(function (req) {
                req.session.zuoraServiceAttempt = 0;
                req.session.save();
            });
            var isInSignup = call.req.session.signupStep && call.req.session.signupStep !== 'completed';
            if (isInSignup) {
                var email = acc.billToContact.workEmail || acc.soldToContact.workEmail;
                performFraudValidation(call, email, function (err) {
                    if (err) {
                        count = -1; // No further call.done calls
                        call.done(err);
                        return;
                    }
                    if (--count === 0) {
                        call.done(null, paymentMethodResponse);
                    }
                });
            } else {
                if (--count === 0) {
                    call.done(null, paymentMethodResponse);
                }
            }

            // Payment method added
            // Have to remove previous billing methods.
            zHelpers.deleteAllButDefaultPaymentMethods(call, function () {
                //Ignoring errors
                if (--count === 0) {
                    call.done(null, paymentMethodResponse);
                }
            });

            // Check if we need to update account info
            zHelpers.composeBillToContact(call, function (err, billToContact) {
                if (err) { // Ignore errors here
                    if (--count === 0) {
                        call.done(null, paymentMethodResponse);
                    }
                    return;
                }

                var same = zHelpers.compareBillToContacts(acc.basicInfo.billToContact, billToContact);
                if (!same) { // Have to update
                    var obj = {
                        billToContact: billToContact,
                        soldToContact: billToContact
                    };

                    zuora.account.update(call.req.session.userId, obj, function () {
                        // Ignoring errors here
                        if (--count === 0) {
                            call.done(null, paymentMethodResponse);
                        }
                    });
                    return;
                }

                if (--count === 0) {
                    call.done(null, paymentMethodResponse);
                }
            });
        };

        //Compose the creditcard object
        zHelpers.composeCreditCardObject(call, function (err, data) {
            if (err) {
                // changing zuoras errorCode from 401's to 500
                if (err.statusCode === 401) {
                    err.statusCode = 500;
                }
                zuoraError(call, err, data, 'CC failed local validation');
                return;
            }
            if (data.creditCardNumber.indexOf('*') !== -1) {
                zHelpers.getPaymentMethods(call, function (paymentErr, pms) {
                    if (paymentErr) {
                        zuoraError(call, paymentErr, data, 'CC number failed local validation');
                        return;
                    }
                    var defaultMethods = pms.creditCards.filter(function (creditCard) {
                        return creditCard.defaultPaymentMethod;
                    });
                    if (defaultMethods.length !== 1) {
                        zuoraError(call, paymentErr, data, 'CC number failed local validation');
                        return;
                    }
                    var defaultMethodId = defaultMethods[0].id;
                    for (var holderKey in data.cardHolderInfo) {
                        data[holderKey] = data.cardHolderInfo[holderKey];
                    }
                    delete data.creditCardNumber;
                    delete data.creditCardType;
                    delete data.cardHolderInfo;
                    delete data.accountKey;

                    zuora.payment.update(defaultMethodId, data, function (updateErr, updateResult) {
                        if (updateErr) {
                            zuoraError(call, updateErr, updateResult, 'Error updating payment method');
                            return;
                        }
                        clearPaymentMethods(updateResult);
                    });
                });
                return;
            }
            // Create payment
            zuora.payment.create(data, function (createErr, resp) {
                if (createErr) {
                    // changing zuoras errorCode from 401's to 500
                    if (createErr.statusCode === 401) {
                        createErr.statusCode = 500;
                    }
                    zuoraError(call, createErr, resp);
                    return;
                }
                call.log.debug('Zuora payment.create returned with', resp);
                clearPaymentMethods(resp);
            });
        });
    };

    // TODO: Some proper error logging
    server.onCall('addPaymentMethod', function (call) {
        call.log.debug('Calling addPaymentMethod');

        var serviceAttempts = call.req.session.zuoraServiceAttempt || 0;
        call.req.session.zuoraServiceAttempt = serviceAttempts + 1;
        call.req.session.save();

        call.log.debug('Checking if zuora account exists');
        zuora.account.get(call.req.session.userId, function (err, acc) {
            if (err) {
                // changing zuoras errorCode from 401's to 500
                if (err.statusCode === 401) {
                    err.statusCode = 500;
                }
                if (!zHelpers.notFound(acc)) {
                    zuoraError(call, err, acc, 'Account check with zuora failed');
                    return;
                }

                call.log.debug('Creating new zuora account');

                zHelpers.createZuoraAccount(call, function (createErr, data, user) {
                    if (createErr) {
                        // changing zuoras errorCode from 401's to 500
                        if (createErr.statusCode === 401) {
                            createErr.statusCode = 500;
                        }
                        zuoraError(call, createErr, data, 'Zuora account.create failed');
                        return;
                    }
                    call.session(function (req) {
                        req.session.zuoraServiceAttempt = 0;
                        req.session.save();
                    });

                    //Set minimum progress to session and ask billing server to update
                    call.log.debug('Updating user progress');
                    call._user = user;

                    performFraudValidation(call, user.email, function (fraudErr) {
                        if (fraudErr === 'User blocked') {
                            call.cloud.updateAccount({phone: call.data.workPhone}, function () {
                                call.done(fraudErr, data);
                            });
                        } else {
                            call.done(fraudErr, data);
                        }
                    });
                });
                return;
            }

            call.log.debug('Attempting to add cc to zuora');

            addOrUpdatePaymentMethod(call, acc);
        });
    });

    server.onCall('getAccountPaymentInfo', function (call) {
        zuora.account.get(call.req.session.userId, function (err, acc) {
            if (err) {
                // changing zuoras errorCode from 401's to 500
                if (err.statusCode === 401) {
                    err.statusCode = 500;
                }
                if (!zHelpers.notFound(acc)) {
                    call.log.warn('Zuora account not found');
                    call.error('Zuora account not found', true);
                    return;
                }
                call.done(err);
                return;
            }
            call.done(null, acc.billToContact || acc.soldToContact);
        });
    });

    if (config.features.invoices !== 'disabled') {
        server.onCall('listInvoices', function (call) {
            zuora.transaction.getInvoices(call.req.session.userId, function (err, resp) {
                if (err) {
                    // changing zuoras errorCode from 401's to 500
                    if (err.statusCode === 401) {
                        err.statusCode = 500;
                    }
                    if (resp && resp.reasons && !resp.success) {
                        err = resp.reasons[0];
                    }
                    call.done(err);
                    return;
                }

                call.done(null, resp.invoices);
            });
        });

        server.onCall('getPayments', function (call) {
            zuora.transaction.getPayments(call.req.session.userId, function (err, resp) {
                if (err) {
                    // changing zuoras errorCode from 401's to 500
                    if (err.statusCode === 401) {
                        err.statusCode = 500;
                    }
                    if (resp && resp.reasons && !resp.success) {
                        err = resp.reasons[0];
                    }
                    call.done(err);
                    return;
                }

                call.done(null, resp.payments);
            });
        });

        server.onCall('getLastInvoice', function (call) {
            zuora.transaction.getInvoices(call.req.session.userId, function (err, resp) {
                if (err) {
                    // changing zuoras errorCode from 401's to 500
                    if (err.statusCode === 401) {
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
                    if (err.statusCode === 401) {
                        err.statusCode = 500;
                    }
                    if (resp && resp.reasons && !resp.success) {
                        err = resp.reasons[0];
                    }
                    call.req.log.warn({err: err, resp: resp}, 'Got zuora error while getting user subscriptions');
                    call.done(err);
                    return;
                }

                call.done(null, resp.subscriptions);
            });
        });

        server.onCall('BillingProductRatePlans', function (call) {
            zuora.catalog.query({sku: call.data.sku}, function (err, arr) {
                if (err) {
                    // changing zuoras errorCode from 401's to 500
                    if (err.statusCode === 401) {
                        err.statusCode = 500;
                    }

                    call.done(err);
                    return;
                }
                call.done(null, arr);
            });
        });

        server.onCall('BillingSubscriptionCreate', {
            verify: function (data) {
                return data && data.hasOwnProperty('ratePlanId') && data.hasOwnProperty('invoiceCollect');
            },

            handler: function (call) {
                zuora.subscription.create({
                    termType: 'EVERGREEN',
                    accountKey: call.req.session.userId,
                    invoiceCollect: call.data.invoiceCollect,
                    contractEffectiveDate: moment().utc().subtract('hours', 8).format('YYYY-MM-DD'), // PST date
                    subscribeToRatePlans: [
                        {
                            productRatePlanId: call.data.ratePlanId
                        }
                    ]
                }, function (err, resp) {
                    if (err) {
                        call.req.log.warn({err: err, resp: resp}, 'Got zuora error while subscribing to support plan');
                        if (err.statusCode === 401) {
                            err.statusCode = 500;
                        }
                        return call.done(err);
                    }

                    var queryString = 'SELECT id, batch, category__c FROM Account WHERE accountNumber = \'' + call.req.session.userId + '\'';
                    zHelpers.zSoap.soap.query(queryString, function (queryErr, queryRes) {
                        if (queryRes && queryRes[0]) {
                            var acc = queryRes[0];
                            if (acc['Category__c'] === 'Credit Card' || acc['Category__c'] === 'Invoice') {
                                var batch = (acc['Category__c'] === 'Credit Card') ? 'Batch15' : 'Batch16';
                                if (batch !== acc.Batch) {
                                    var updateData = {
                                        Id: acc.Id,
                                        Batch: batch,
                                        __type: 'Account'
                                    };
                                    zHelpers.zSoap.soap.update([updateData], function (updateErr, updateRes) {
                                        var success = updateRes && updateRes[0] && updateRes[0].Success;
                                        if (updateErr || !success) {
                                            call.req.log.warn({err: updateErr, resp: updateRes}, 'Got zuora error while updating account');
                                        } else {
                                            call.req.log.info('Updating zuora account batch');
                                        }
                                        return acc;
                                    });
                                }
                            }
                        }
                    });
                    return call.done(null, resp.subscriptions);
                });
            }
        });

        server.onCall('BillingSubscriptionCancel', {
            verify: function (data) {
                return data && data.hasOwnProperty('ids');
            },

            handler: function (call) {
                var unsubscribe = function (subscriptionId, unsubscribeCallback) {
                    zuora.subscription.cancel(subscriptionId, {
                        cancellationPolicy: 'SpecificDate',
                        invoiceCollect: false,
                        cancellationEffectiveDate: moment().utc().subtract('hours', 8).format('YYYY-MM-DD')
                    }, unsubscribeCallback);
                };
                zuora.subscription.getByAccount(call.req.session.userId, function (subsErr, subsResult) {
                    if (subsErr) {
                        if (subsErr.statusCode === 401) {
                            subsErr.statusCode = 500;
                        }
                        call.done(subsErr);
                    } else {
                        var activeSubscriptions = [];
                        subsResult.subscriptions.forEach(function (subscription) {
                            if (subscription.status !== 'Cancelled') {
                                subscription.ratePlans.forEach(function (ratePlan) {
                                    if (call.data.ids.indexOf(ratePlan.productRatePlanId) !== -1) {
                                        activeSubscriptions.push(subscription.id);
                                    }
                                });
                            }
                        });
                        activeSubscriptions = activeSubscriptions.filter(function (subscriptionId, index) {
                            return activeSubscriptions.indexOf(subscriptionId) === index;
                        });
                        if (activeSubscriptions.length === 0) {
                            call.done();
                        } else {
                            var activeSubscriptionsCount = activeSubscriptions.length;
                            activeSubscriptions.forEach(function (currentSubscription) {
                                unsubscribe(currentSubscription, function (unsubErr, unsubRes) {
                                    if (unsubErr) {
                                        call.req.log.warn({err: unsubErr, resp: unsubRes}, 'Got zuora error while unsubscribing from support plan');
                                    }
                                    activeSubscriptionsCount -= 1;
                                    if (activeSubscriptionsCount === 0) {
                                        call.done();
                                    }
                                });
                            });
                        }
                    }
                });
            }
        });
    }

    zHelpers.init(zuora);
};
