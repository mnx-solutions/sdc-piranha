'use strict';

var fs = require('fs');
var path = require('path');
var config = require('easy-config');
var zuora = require('zuora').create(config.zuora.api);
var moment = require('moment');


var zuoraErrors = {};

function init(callback) {
    // Here we init the zuora errors (its a mess)
    fs.readFile(path.join(process.cwd(), '/var/errors.json'), function (err, data) {
        if(err) {
            callback(err);
            return;
        }
        zuoraErrors = JSON.parse(data);
        callback();
    });

}

module.exports.init = init;

function notFound(resp) {
    return (resp && resp.reasons && resp.reasons.length === 1 && resp.reasons[0].split.category.nr === '40');
}

module.exports.notFound = notFound;

function updateErrorList(scope, resp, callback) {

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

module.exports.updateErrorList = updateErrorList;

function composeCreditCardObject(call, cb) {
    //Compose the creditcard object
    var data = {
        accountKey: call.req.session.userId,
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
        setImmediate(cb.bind(cb, null, data));
        return;
    }

    zuora.payment.create(data, function (err, resp) { // Should never pass
        Object.keys(preErr).forEach(function (k) {
            err[k] = preErr[k];
        });
        delete err['cardHolderInfo.cardHolderName'];
        cb(err, resp);
    });
}

module.exports.composeCreditCardObject = composeCreditCardObject;

function composeBillToContact(call, acc, cb) {
    if(!cb && typeof acc === 'function') {
        cb = acc;
        acc = null;
    }

    function compose(data) {
        var billToContact = {
            firstName: call.data.firstName,
            lastName: call.data.lastName,
            country: call.data.cardHolderInfo.country || data.country || null,
            workEmail: data.email
        };

        Object.keys(call.data.cardHolderInfo).forEach(function (k) {
            if(k === 'cardHolderName') {
                return;
            }
            var key = ((k === 'addressLine1' && 'address1') || (k === 'addressLine2' && 'address2') || k);
            billToContact[key] = billToContact[key] || call.data.cardHolderInfo[k];
        });
        cb(null, billToContact);
    }
    if(acc) {
        setImmediate(compose.bind({}, acc));
        return;
    }
    call.cloud.getAccount(function (err, data) {
        if(err) {
            cb(err);
            return;
        }
        compose(data);
    });
}

module.exports.composeBillToContact = composeBillToContact;

var countries = require('zuora').countries.array;
var indexedCountries = {};
countries.forEach(function (el) {
    indexedCountries[el.iso3] = el.name;
});

function compareBillToContacts(zContact, contact) {

    return Object.keys(contact).some(function (k) {
        if(k === 'country') {
            return zContact[k] === indexedCountries[contact[k]];
        }
        return zContact[k] === contact[k];
    });
}

module.exports.compareBillToContacts = compareBillToContacts;

function composeZuoraAccount(call, cb) {
    composeCreditCardObject(call, function (err, cc) {
        if(err) {
            cb(err);
            return;
        }
        call.cloud.getAccount(function (err, data) {
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
                    subscription: {
                        termType: 'EVERGREEN',
                        contractEffectiveDate: moment().utc().subtract('hours', 8).format('YYYY-MM-DD'), // PST date
                        subscribeToRatePlans: [{
                            productRatePlanId: ratePlans['Free Trial']
                        }]
                    },
                    invoiceCollect: false,
                    creditCard: {}
                };

                Object.keys(cc).forEach(function (k) {
                    if(k === 'firstName' || k === 'lastName') {
                        return;
                    }
                    var key = ((k === 'creditCardType' && 'cardType')
                        || (k === 'creditCardNumber' && 'cardNumber')
                        || k);
                    obj.creditCard[key] = cc[k];
                });

                composeBillToContact(call, data, function (err3, billToContact) {
                    if(err3) {
                        cb(err3);
                        return;
                    }
                    obj.billToContact = billToContact;
                    cb(null, obj, data);
                });
            });
        });
    });
}

module.exports.composeZuoraAccount = composeZuoraAccount;

function getPaymentMethods(call, cb){
    zuora.payment.get(call.req.session.userId, function (err, pms) {
        if(err) {
            if(notFound(pms)) {
                cb(null, []);
                return;
            }
            cb(err);
            return;
        }

        cb(null, pms);
    });
}

module.exports.getPaymentMethods = getPaymentMethods;

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

module.exports.getAllButDefaultPaymentMethods = getAllButDefaultPaymentMethods;

function deleteAllButDefaultPaymentMethods(call, cb) {
    getAllButDefaultPaymentMethods(call, function (err, notDefault) {
        if(err) { // Ignore errors
            cb(err);
            return;
        }
        var count = notDefault.length;
        if(count < 1) {
            cb();
            return;
        }
        notDefault.forEach(function (el) {
            zuora.payment.del(el.id, function (err2, resp) {
                // Ignoring errors here
                if(--count === 0) {
                    cb();
                }
            });
        });
    });
}

module.exports.deleteAllButDefaultPaymentMethods = deleteAllButDefaultPaymentMethods;

function createZuoraAccount(call, cb) {
    //User not found so create one
    composeZuoraAccount(call, call.log.noErr('Unable to compose Account', cb, function (obj, user) {
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
        zuora.account.create(obj, function (accErr, accResp) {
            if(accErr && accResp && accResp.reasons) {
                call.log.error('Zuora account creation failed', accResp.reasons);
            }
            if(accErr) {
                accErr.zuora = accResp;
                cb(accErr);
                return;
            }
            call.log.debug('Zuora account creation succeeded');
            cb(null, accResp, user);
        });
    }));
}

module.exports.createZuoraAccount = createZuoraAccount;