'use strict';

var config = require('easy-config');
var moment = require('moment');
var zuora = require('zuora').create(config.zuora.api);
var restify = require('restify');
var path = require('path');
var fs = require('fs');

var zuoraErrors = {};


module.exports = function execute(scope, callback) {

    // Here we init the zuora errors (its a mess)
    fs.readFile(path.join(process.cwd(), '/var/errors.json'), function (err, data) {
        if(err) {
            scope.log.fatal('failed to load error file for zuora', err);
            process.exit();
        }
        zuoraErrors = JSON.parse(data);
        callback();
    });

    function updateErrorList(resp, callback) {

        var newErr = false;
        if(resp && resp.reasons) {
            resp.reasons.forEach(function (e) {
                if(!zuoraErrors[e.message]) {
                    newErr = true;
                    zuoraErrors[e.message] = e;
                }
            });
            if(newErr) {
                fs.writeFile(path.join(process.cwd(), '/var/errors.json'), JSON.stringify(zuoraErrors, null, 2), 'utf8', function (err) {
                    if(err) {
                        scope.log.error('Failed to update zuora error file', err);
                    }
                    callback();
                });
                return;
            }
        }
        setImmediate(callback);
    }

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
                    billCycleDay: 1,
                    name: data.companyName || ((data.firstName || call.data.firstName) + ' ' + (data.lastName || call.data.lastName)),
                    billToContact: {
                        firstName: call.data.firstName,
                        lastName: call.data.lastName,
                        country: call.data.cardHolderInfo.country || data.country || null,
                        workEmail: data.email
                    },
                    subscription: {
                        termType: 'EVERGREEN',
                        contractEffectiveDate: moment().utc().subtract('hours', 8).format('YYYY-MM-DD'), // PST date
                        subscribeToRatePlans: [{
                            productRatePlanId: ratePlans['Free Trial']
                        }]
                    },
                    invoiceCollect: false
                };
                cb(null, obj, data);
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
        getAccountId(call, call.log.noErr('Failed to get account info', cb, function (id) {
            zuora.payment.get(id, function (err, pms) {
                if(err) {
                    if(pms && pms.reasons && pms.reasons.length === 1 && pms.reasons[0].split.category.nr === '40') {
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

    function getAllButDefaultPaymentMethods(call, cb) {
        getPaymentMethods(call, function (err, pms) {
            if(err) {
                cb(err);
                return;
            }
            var arr = [];
            if(pms.creditCards) {
                arr = pms.creditCards.filter(function (el) {
                    return !el.defaultPaymentMethod;
                });
            }
            cb(null, arr);
        });
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

    var ids = {};

    //TODO: Some proper error logging
    server.onCall('addPaymentMethod', function (call) {

        if(ids[call.__id]) {
            var stack = new Error().stack;
            call.log.error(stack, 'Called twice');
            return;
        }
        ids[call.__id] = true;

        function updateProgress(user, resp) {
            call._user = user;
            SignupProgress.setMinProgress(call, 'billing', function (err) {
                if(err) {
                    call.log.error(err);
                }
                call.done(null, resp);
            });
        }
        composeZuora(call, call.log.noErr('Unable to get Account', call.done, function (obj, user) {
            // Get the account object ready
            obj.creditCard = {};
            Object.keys(call.data).forEach(function (k) {
                if(k === 'firstName' || k === 'lastName') {
                    return;
                }
                var key = ((k === 'creditCardType' && 'cardType')
                    || (k === 'creditCardNumber' && 'cardNumber')
                    || k);
                obj.creditCard[key] = call.data[k];
            });
            Object.keys(call.data.cardHolderInfo).forEach(function (k) {
                if(k === 'cardHolderName') {
                    return;
                }
                var key = ((k === 'addressLine1' && 'address1') || (k === 'addressLine2' && 'address2') || k);
                obj.billToContact[key] = obj.billToContact[key] || call.data.cardHolderInfo[k];
            });

            //Compose the creditcard object
            var data = {
                accountKey: obj.accountNumber,
                defaultPaymentMethod: true
            };
            Object.keys(call.data).forEach(function (k) {
                if(k !== 'firstName' && k !== 'lastName'){
                    data[k] = call.data[k];
                }
            });
            var preErr = null;
            if(!call.data.firstName || call.data.firstName.trim() === ''){
                preErr = {
                    firstName: 'String is empty'
                };
            }
            if (!call.data.lastName || call.data.lastName.trim() === '') {
                preErr = preErr || {};
                preErr.lastName = 'String is empty';
            }
            if (!preErr) {
                data.cardHolderInfo.cardHolderName = call.data.firstName + ' ' + call.data.lastName;
            }

            // Create payment
            zuora.payment.create(data, function (err, resp) {
                if(err) {
                    if(resp && resp.reasons.length === 1 && resp.reasons[0].split.field.nr === '01') {
                        zuora.account.create(obj, function (accErr, accResp) {
                            if(accErr && accResp && accResp.reasons) {
                                call.log.error('Zuora account creation failed', accResp.reasons);
                            }
                            if(accErr) {
                                accErr.zuora = accResp;
                                call.done(accErr);
                                return;
                            }
                            updateProgress(user, accResp);
                        });
                        return;
                    }
                    if(preErr) {
                        Object.keys(preErr).forEach(function (k) {
                            err[k] = preErr[k];
                        });
                        delete err['cardHolderInfo.cardHolderName'];
                    }

                    call.log.error('Failed to save to zuora', err, resp && resp.reasons);
                    updateErrorList(resp, function () {
                        err.zuora = resp;
                        call.done(err);
                    });
                    return;
                }
                // No error - so update the account
                var accData = {
                    billToContact: obj.billToContact,
                    soldToContact: obj.billToContact
                };
                zuora.account.update(obj.accountNumber, accData, function (accErr, accResp) {
                    if(accErr) {
                        call.log.error('Zuora account update failed', accErr, accResp && accResp.reasons);
                        updateErrorList(accResp, function () {});
                    }
                    // Have to remove previous billing methods.
                    getAllButDefaultPaymentMethods(call, function (err, notDefault) {
                        if(err) { // Ignore errors
                            updateProgress(user, accResp);
                            return;
                        }
                        var count = notDefault.length;
                        if(count < 1) {
                            updateProgress(user, accResp);
                            return;
                        }
                        notDefault.forEach(function (el) {
                            zuora.payment.del(el.id, function (err, resp) {
                                // Ignoring errors here
                                if(--count === 0) {
                                    updateProgress(user, accResp);
                                }
                            });
                        });
                    });
                });
            });
        }));
    });

    function getInvoiceList(call, cb) {
        getAccountId(call, call.log.noErr('Failed to get account info', cb, function (id) {
            zuora.transaction.getInvoices(id, cb);
        }));
    }

    server.onCall('listInvoices', function (call) {
        getInvoiceList(call, function (err, resp) {
            if(err) {
                call.done(err);
                return;
            }
            call.done(null, resp.invoices);
        });
    });

    server.onCall('getLastInvoice', function (call) {
        getInvoiceList(call, function (err, resp) {
            if(err) {
                call.done(err);
                return;
            }
            if(!resp.invoices.length) {
                call.done(null, null);
                return;
            }
            resp.invoices.sort(function (a, b) {
                return moment(b.invoiceDate).unix() - moment(a.invoiceDate).unix();
            });

            call.done(null, resp.invoices[0]);
        });
    });
};