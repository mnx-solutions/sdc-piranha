'use strict';

var fs = require('fs');
var path = require('path');
var config = require('easy-config');
var options = config.zuora.rest;
options.url = options.endpoint;
options.password = config.zuora.password;
options.user = config.zuora.user;

var zuora = require('zuora').create(options);
var zuoraSoap = require('./zuora');
var moment = require('moment');


var zuoraErrors = {};

function init(zuoraInit, callback) {
    if(typeof zuoraInit === 'function') {
        callback = zuoraInit;
        zuoraInit = false;
    } else {
        zuora = zuoraInit;
    }
    var count = 2;
    var sent = false;
    function end(err, type) {
        if(sent) {
            return;
        }
        if(err) {
            callback(err, type);
            sent = true;
            return;
        }
        if(--count === 0) {
            callback();
            sent = true;
        }
    }
    // Here we init the zuora errors (its a mess)
    fs.readFile(path.join(process.cwd(), '/var/errors.json'), function (err, data) {
        if(err) {
            end(err, 'errors');
            return;
        }
        zuoraErrors = JSON.parse(data);
        end();
    });

	var options = config.zuora.soap;
	options.password = config.zuora.password;
	options.user = config.zuora.user;
	options.tenantId = config.zuora.tenantId;

    zuoraSoap.connect(config.zuora.soap, function (err) {
        if(err) {
            end(err, 'soap');
            return;
        }
        end();
    });
}

module.exports.init = init;

function notFound(resp) {
    // Return true if there is only one error and it is in the not found category.
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
    // Copy all properties except first and last name
    Object.keys(call.data).forEach(function (k) {
        if(k !== 'firstName' && k !== 'lastName' && k !== 'workPhone'){
            data[k] = call.data[k];
        }
    });
    // Check if both first and last name are set
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
    // Everything seems valid so set cardHolderName and return the data
    if (!preErr) {
        data.cardHolderInfo.cardHolderName = call.data.firstName + ' ' + call.data.lastName;
        setImmediate(cb.bind(cb, null, data));
        return;
    }

    // Make a call to zuora with cardHolderName missing to find out what other errors there are
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
            workEmail: data.email,
	        workPhone: call.data.workPhone
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

    if (!zContact) {
        return false;
    }

    // Check if all properties match
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
            // Find the trial product
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
                    if(k === 'firstName' || k === 'lastName' || k === 'workPhone') {
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
            if(k === 'firstName' || k === 'lastName' || k === 'workPhone') {
                return;
            }
            var key = ((k === 'creditCardType' && 'cardType')
                || (k === 'creditCardNumber' && 'cardNumber')
                || k);
            obj.creditCard[key] = call.data[k];
        });
        zuora.account.create(obj, function (accErr, accResp) {
            if(accErr) {
                accErr.zuora = accResp;
                cb(accErr, accResp);
                return;
            }
            call.log.debug('Zuora account creation succeeded');
            cb(null, accResp, user);
        });
    }));
}

module.exports.createZuoraAccount = createZuoraAccount;

function getInvoicePDF(req, res, next) {
    zuoraSoap.queryPDF(req.params.account, req.params.id,function (err, data) {
        if(err) {
            next(err);
            return;
        }
        var buffer = new Buffer(data.Body,'base64');
        res.set({
            'Accept-Ranges':'bytes',
            'Content-Disposition':'attachment; filename="' + data.InvoiceNumber + '.pdf"',
            'Content-Length': buffer.length,
            'Content-Type':'application/pdf'
        });
        res.send(buffer);
    });
}
module.exports.zSoap = zuoraSoap;

module.exports.getInvoicePDF = getInvoicePDF;