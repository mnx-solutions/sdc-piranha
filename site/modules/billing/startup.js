'use strict';

var config = require('easy-config');
var moment = require('moment');
var zuora = require('zuora').create(config.zuora.api);
var restify = require('restify');
var jsonClient = null;

if(!config.billing.noUpdate) {
    jsonClient = restify.createJsonClient({url: config.billing.url});
}

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
                    billCycleDay: 1,
                    name: data.company || data.firstName + ' ' + data.lastName,
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
                    if(pms && pms.reasons && pms.reasons.length === 1 && pms.reasons[0].split.category === '40') {
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

    //TODO: Some proper error logging
    server.onCall('addPaymentMethod', function (call) {
        var obj = {};

        function setProgress(resp) {
            var count = 1;
            //We have successfully updated zuora - update billingAPI
            if (jsonClient) {
                count++;
                jsonClient.get('/update/' + obj.accountNumber, function (err, req, res, obj) {
                    if(err) {
                        scope.log.error('Something went wrong with billing API', err);
                    }
                    //No error handling or nothing here, just let it pass.
                    if(--count === 0) {
                        call.done(null, resp);
                    }
                });
            }
            SignupProgress.setMinProgress(call, 'billing', function (err) {
                if(err) {
                    scope.log.error(err);
                }
                if(--count === 0) {
                    call.done(null, resp);
                }
            });
        }
        composeZuora(call, scope.log.noErr('Unable to get Account', call.done, function (acc) {
            obj = acc;
            // Get the account object ready
            obj.creditCard = {};
            Object.keys(call.data).forEach(function (k) {
                if(k === 'firstName' || k === 'lastName') {
                    return;
                }
                var key = ((k === 'creditCardType' && 'cardType') || (k === 'creditCardNumber' && 'cardNumber') || k);
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
                            if(accResp && accResp.reasons) {
                                scope.log.error('Zuora account creation failed', accResp.reasons);
                            }
                            if(accErr) {
                                accErr.zuora = accResp;
                                call.done(accErr);
                                return;
                            }
                            setProgress(accResp);
                        });
                        return;
                    }
                    if(preErr) {
                        Object.keys(preErr).forEach(function (k) {
                            err[k] = preErr[k];
                        });
                        delete err['cardHolderInfo.cardHolderName'];
                    }

                    scope.log.error('Failed to save to zuora', err, resp && resp.reasons);
                    err.zuora = resp;
                    call.done(err);
                    return;
                }
                // No error - so update the account
                var accData = {
                    billToContact: obj.billToContact,
                    soldToContact: obj.billToContact
                };
                zuora.account.update(obj.accountNumber, accData, function (accErr, accResp) {
                    if(accErr) {
                        scope.log.error('Zuora account update failed', accErr, accResp && accResp.reasons);
                    }
                    if(!call.req.session.signupStep || call.req.session.signupStep !== 'complete') {
                        setProgress(resp);
                        return;
                    }
                    call.done(null, resp);
                });
            });
        }));
    });

    function getInvoiceList(call, cb) {
//        getAccountId(call, scope.log.noErr('Failed to get account info', cb, function (id) {
//            zuora.transaction.getInvoices(id, cb);
//        }));
        setImmediate(function () {
            cb(null, {
                'invoices': [
                    {
                        "accountId": "2c92a0f9391832b10139183e277a0042",
                        "accountName": "subscribeCallYan_1",
                        "dueDate": "2012-08-11",
                        "id": "2c92a09739190dc60139194bcf1b0098",
                        "status": "Posted",
                        "createdBy": "23",
                        "balance": 0.0,
                        "invoiceTargetDate": "2012-08-11",
                        "invoiceNumber": "INV00000160",
                        "invoiceDate": "2012-08-11",
                        "accountNumber": "A00001115",
                        "invoiceItems": [
                            {
                                "productName": "Recurring Charge",
                                "chargeId": "2c92a09739190dc60139194bc95a0059",
                                "unitOfMeasure": "MMPV",
                                "quantity": 20.0,
                                "serviceStartDate": "2012-08-01",
                                "subscriptionName": "A-S00001013",
                                "taxAmount": 0.0,
                                "chargeDescription": "",
                                "subscriptionId": "2c92a09739190dc60139194bc90a0046",
                                "id": "2c92a09739190dc60139194bd0e800ac",
                                "chargeName": "Flat",
                                "chargeAmount": 484.0,
                                "serviceEndDate": "2012-08-31"
                            },
                            {
                                "productName": "Recurring Charge",
                                "chargeId": "2c92a09739190dc60139194bc91a0052",
                                "unitOfMeasure": "MMPV",
                                "quantity": 20.0,
                                "serviceStartDate": "2011-01-01",
                                "subscriptionName": "A-S00001013",
                                "taxAmount": 0.0,
                                "chargeDescription": "",
                                "subscriptionId": "2c92a09739190dc60139194bc90a0046",
                                "id": "2c92a09739190dc60139194bd00f00a3",
                                "chargeName": "Flat",
                                "chargeAmount": 400.0,
                                "serviceEndDate": "2011-01-31"
                            },
                            {
                                "productName": "Recurring Charge",
                                "chargeId": "2c92a09739190dc60139194bc91a0051",
                                "unitOfMeasure": "DOWN",
                                "quantity": 10.0,
                                "serviceStartDate": "2011-01-01",
                                "subscriptionName": "A-S00001013",
                                "taxAmount": 0.0,
                                "chargeDescription": "",
                                "subscriptionId": "2c92a09739190dc60139194bc90a0046",
                                "id": "2c92a09739190dc60139194bd16300b1",
                                "chargeName": "New Component",
                                "chargeAmount": 100.0,
                                "serviceEndDate": "2011-01-31"
                            }
                        ],
                        "amount": 10521.0
                    },
                    {
                        "accountId": "2c92a0f9391832b10139183e277a0042",
                        "accountName": "subscribeCallYan_1",
                        "dueDate": "2012-08-11",
                        "id": "2c92a09539190dbe0139190f42780012",
                        "status": "Posted",
                        "createdBy": "23",
                        "balance": 0.0,
                        "invoiceTargetDate": "2012-08-11",
                        "invoiceNumber": "INV00000159",
                        "invoiceDate": "2012-08-11",
                        "accountNumber": "A00001115",
                        "invoiceItems": [
                            {
                                "productName": "Recurring Charge",
                                "chargeId": "2c92a0f9391832b10139183e2aae004b",
                                "unitOfMeasure": "",
                                "quantity": 1.0,
                                "serviceStartDate": "2011-02-11",
                                "subscriptionName": "A-S00001008",
                                "taxAmount": 0.0,
                                "chargeDescription": "",
                                "subscriptionId": "2c92a0f9391832b10139183e28780046",
                                "id": "2c92a09539190dbe0139190f44000015",
                                "chargeName": "Recurring",
                                "chargeAmount": 10.0,
                                "serviceEndDate": "2012-02-10"
                            }
                        ],
                        "amount": 10.0
                    },
                    {
                        "accountId": "2c92a0f9391832b10139183e277a0042",
                        "accountName": "subscribeCallYan_1",
                        "dueDate": "2012-10-08",
                        "id": "2c92a0953a3fa95d013a401914770aa1",
                        "status": "Canceled",
                        "createdBy": "23",
                        "balance": 2420.0,
                        "invoiceTargetDate": "2012-12-08",
                        "invoiceNumber": "INV00000253",
                        "invoiceDate": "2012-10-08",
                        "accountNumber": "A00001115",
                        "invoiceItems": [
                            {
                                "productName": "Recurring Charge",
                                "chargeId": "2c92a09739190dc60139194bc979005c",
                                "unitOfMeasure": "DOWN",
                                "quantity": 10.0,
                                "serviceStartDate": "2012-12-01",
                                "subscriptionName": "A-S00001013",
                                "taxAmount": 0.0,
                                "chargeDescription": "",
                                "subscriptionId": "2c92a09739190dc60139194bc90a0046",
                                "id": "2c92a0953a3fa95d013a401914b50aa6",
                                "chargeName": "New Component",
                                "chargeAmount": 121.0,
                                "serviceEndDate": "2012-12-31"
                            },
                            {
                                "productName": "Recurring Charge",
                                "chargeId": "2c92a09739190dc60139194bc95a0059",
                                "unitOfMeasure": "MMPV",
                                "quantity": 20.0,
                                "serviceStartDate": "2012-12-01",
                                "subscriptionName": "A-S00001013",
                                "taxAmount": 0.0,
                                "chargeDescription": "",
                                "subscriptionId": "2c92a09739190dc60139194bc90a0046",
                                "id": "2c92a0953a3fa95d013a401914ff0aac",
                                "chargeName": "Flat",
                                "chargeAmount": 484.0,
                                "serviceEndDate": "2012-12-31"
                            },
                            {
                                "productName": "Recurring Charge",
                                "chargeId": "2c92a09739190dc60139194bc95a0059",
                                "unitOfMeasure": "MMPV",
                                "quantity": 20.0,
                                "serviceStartDate": "2012-11-01",
                                "subscriptionName": "A-S00001013",
                                "taxAmount": 0.0,
                                "chargeDescription": "",
                                "subscriptionId": "2c92a09739190dc60139194bc90a0046",
                                "id": "2c92a0953a3fa95d013a401914da0aa9",
                                "chargeName": "Flat",
                                "chargeAmount": 484.0,
                                "serviceEndDate": "2012-11-30"
                            },
                            {
                                "productName": "Recurring Charge",
                                "chargeId": "2c92a09739190dc60139194bc979005c",
                                "unitOfMeasure": "DOWN",
                                "quantity": 10.0,
                                "serviceStartDate": "2012-11-01",
                                "subscriptionName": "A-S00001013",
                                "taxAmount": 0.0,
                                "chargeDescription": "",
                                "subscriptionId": "2c92a09739190dc60139194bc90a0046",
                                "id": "2c92a0953a3fa95d013a401915120aae",
                                "chargeName": "New Component",
                                "chargeAmount": 121.0,
                                "serviceEndDate": "2012-11-30"
                            },
                            {
                                "productName": "Recurring Charge",
                                "chargeId": "2c92a09739190dc60139194bc95a0059",
                                "unitOfMeasure": "MMPV",
                                "quantity": 20.0,
                                "serviceStartDate": "2012-09-01",
                                "subscriptionName": "A-S00001013",
                                "taxAmount": 0.0,
                                "chargeDescription": "",
                                "subscriptionId": "2c92a09739190dc60139194bc90a0046",
                                "id": "2c92a0953a3fa95d013a401914a20aa5",
                                "chargeName": "Flat",
                                "chargeAmount": 484.0,
                                "serviceEndDate": "2012-09-30"
                            },
                            {
                                "productName": "Recurring Charge",
                                "chargeId": "2c92a09739190dc60139194bc979005c",
                                "unitOfMeasure": "DOWN",
                                "quantity": 10.0,
                                "serviceStartDate": "2012-09-01",
                                "subscriptionName": "A-S00001013",
                                "taxAmount": 0.0,
                                "chargeDescription": "",
                                "subscriptionId": "2c92a09739190dc60139194bc90a0046",
                                "id": "2c92a0953a3fa95d013a401914c70aa7",
                                "chargeName": "New Component",
                                "chargeAmount": 121.0,
                                "serviceEndDate": "2012-09-30"
                            }
                        ],
                        "amount": 2420.0
                    }
                ],
                'success': true
            });
        });
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



    setImmediate(callback);
};