'use strict';

var config = require('easy-config');
var zuora = require('zuora').create(config.zuora.account);

module.exports = function (scope, callback) {
    var server = scope.api('Server');



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
                }
            };

            cb(null, obj);
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
        getAccountId(call, scope.log.noErr('Failed to get account info', call.done, function (id) {
            var data = {
                accountKey: id,
                defaultPaymentMethod: true
            };
            Object.keys(call.data).forEach(function (k) {
                data[k] = call.data[k];
            });
            console.log(data);
            zuora.payment.create(data, function (err, resp) {
                console.log(arguments);
                console.log(resp.reasons);
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
                            console.log(obj);
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
                                call.done(null, accResp);
                            });
                        }));
                        return;
                    }
                    scope.log.error('Failed to save to zuora', err, resp.reasons);
                    call.done(err);
                    return;
                }
                call.done(null, resp);
            });
        }));
    });

    setImmediate(callback);
};