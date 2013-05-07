'use strict';

var config = require('easy-config');
var moment = require('moment');
var zuora = require('zuora').create(config.zuora.account);

module.exports = function (scope, callback) {

    var server = scope.api('Server');
    var SignupProgress = scope.api('SignupProgress');

    function getAccount(call, cb) {
        call.cloud.getAccount(function (err, data) {
            if(err) {
                cb(err);
                return;
            }
            call.req.session.userId = data.id;
            call.req.session.save();
            cb(null, data);
        });
    }

    function composeZuora(call, cb) {
        getAccount(call, function (err, data) {
            if(err) {
                cb(err);
                return;
            }
            zuora.catalog.query({sku:'SKU-00000014'}, function (err2, arr) {
                if(err2) {
                    cb(err2);
                    return;
                }
                if(arr.length < 1) {
                    cb(new Error('Unable to find necessary product'));
                    return;
                }

                var ratePlans = {};
                arr[0].productRatePlans.forEach(function (ratePlan) {
                    ratePlans[ratePlan.name] = ratePlan.id;
                });

                var obj = {
                    accountNumber: data.id,
                    currency: 'USD',
                    paymentTerm: 'Due Upon Receipt',
                    Category__c: 'Credit Card',
                    billCycleDay: 0,
                    name: data.firstName + ' ' + data.lastName,
                    billToContact: {
                        firstName: data.firstName,
                        lastName: data.lastName,
                        country: data.country || null
                    },
                    subscription: {
                        termType: 'EVERGREEN',
                        contractEffectiveDate: moment().format('YYYY-MM-DD'),
                        subscribeToRatePlans: [{
                            productRatePlanId: ratePlans['Free Trial']
                        }]
                    },
                    invoiceCollect: false
                };
                cb(null, obj);
            });
        });
    }
    function getAccountId(call, cb) {
        if(call.req.session.userId) {
            setImmediate(function () {
                cb(null, call.req.session.userId);
            });
            return;
        }
        getAccount(call, function (err, data) {
            cb(err, data && data.id);
        });
    }

    function getPaymentMethods(call, cb){
        getAccountId(call, scope.log.noErr('Failed to get account info', cb, function (id) {
            zuora.payment.get(id, function (err, pms) {
                if(err) {
                    if(pms.reasons && pms.reasons.length === 1 && pms.reasons[0].split.category === '40') {
                        cb(null, []);
                        return;
                    }
                    cb(err);
                    return;
                }

                cb(null, pms);
            });
        }));
    }


    server.onCall('listPaymentMethods', function (call) {
        getPaymentMethods(call, call.done.bind(call));
    });

    server.onCall('defaultCreditCard', function (call) {
        getPaymentMethods(call, function (err, pms) {
            if(err) {
                call.done(err);
                return;
            }
            var def = {};
            if(pms.creditCards) {
                pms.creditCards.some(function (d) {
                    if(d.defaultPaymentMethod) {
                        def = d;
                        return true;
                    }
                });
            }
            call.done(null, def);
        });
    });

    server.onCall('addPaymentMethod', function (call) {

        function setProgress(resp) {
            SignupProgress.setMinProgress(call.req, 'billing', function (err) {
                if(err) {
                    scope.log.error(err);
                }
                call.session(function (req) {
                    req.session.signupStep = 'billing';
                    req.session.save();
                });
                call.done(null, resp);
            });
        }

        getAccountId(call, scope.log.noErr('Failed to get account info', call.done, function (id) {
            var data = {
                accountKey: id,
                defaultPaymentMethod: true
            };
            Object.keys(call.data).forEach(function (k) {
                data[k] = call.data[k];
            });
            zuora.payment.create(data, function (err, resp) {
                if(err) {
                    if(resp && resp.reasons.length === 1 && resp.reasons[0].split.field.nr === '01') {
                        composeZuora(call, scope.log.noErr('Unable to get Account', call.done, function (obj) {
                            obj.creditCard = {};
                            Object.keys(call.data).forEach(function (k) {
                                var key = ((k === 'creditCardType' && 'cardType') || (k === 'creditCardNumber' && 'cardNumber') || k);
                                obj.creditCard[key] = call.data[k];
                            });
                            Object.keys(call.data.cardHolderInfo).forEach(function (k) {
                                var key = ((k === 'addressLine1' && 'address1') || (k === 'addressLine2' && 'address2') || k);
                                obj.billToContact[key] = obj.billToContact[key] || call.data.cardHolderInfo[k];
                            });
                            zuora.account.create(obj, function (accErr, accResp) {
                                if(accResp.reasons) {
                                    accResp.reasons.forEach(function(r) {
                                        console.log(r);
                                    });
                                }
                                if(accErr) {
                                    call.done(accErr);
                                    return;
                                }
                                setProgress(accResp);
                            });
                        }));
                        return;
                    }
                    scope.log.error('Failed to save to zuora', err, resp && resp.reasons);
                    call.done(err);
                    return;
                }
                if(!call.req.session.signupStep || call.req.session.signupStep !== 'complete') {
                    setProgress(resp);
                    return;
                }
                call.done(null, resp);
            });
        }));
    });

    setImmediate(callback);
};