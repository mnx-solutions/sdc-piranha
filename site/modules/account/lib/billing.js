'use strict';

var config = require('easy-config');
var restify = require('restify');

if (!config.billing.url && !config.billing.noUpdate) {
    throw new Error('Billing.url must be defined in the config');
}

var jsonClient = null;

if (config.billing.noUpdate) { // Create dummy for noUpdate
    jsonClient = {
        'get': function (p, cb) {
            setImmediate(cb);
        }
    };
} else {
    jsonClient = restify.createJsonClient({
        url: config.billing.url,
        rejectUnauthorized: config.billing.rejectUnauthorized
    });
}

var BillingApi = (function () {
    function BillingApi(scope) {
        this.scope = scope;
    }
    BillingApi.prototype.getStepWithMethod = function (method, userId, cb) {
        var self = this;
        jsonClient.get('/' + method + '/' + userId, function (err, req, res, obj) {
            if (!err) {
                self.scope.log.debug('zuora(%s) allows provision', method);
                cb(null, 'completed'); // Can provision so we let through
                return;
            }
            if (!obj || !obj.errors) {
                self.scope.log.warn({err: err}, 'zuora didnt respond, allowing through');
                cb(null, 'completed'); // Can provision so we let through
                return;
            }
            self.scope.log.debug({obj: obj, method: method}, 'got error from zuora, handling it');
            if (obj.errors && obj.errors[0].code === 'U01' && method === 'provision') {
                self.scope.log.debug('checking update method');

                self.getStepWithMethod('update', userId, cb);
                return;
            }
            var errs = obj.errors.filter(function (el) {
                return el.code !== 'U01';
            });
            var state = 'start';
            if (errs.length === 0) { // The only error was provisioning flag - letting through
                state = 'completed';
            } else if (errs.length === 1 && errs[0].code.charAt(0) === 'Z') { // There was only a billing error
                state = 'phone'; // which means billing
            }
            cb(null, state);
        });
    };
    BillingApi.prototype.getStep = function (userId, cb) {
        this.getStepWithMethod('provision', userId, cb);
    };
    BillingApi.prototype.isActive = function (userId, cb) {
        this.getStep(userId, function (err, step) {
            cb(null, !err && step === 'completed');
        });
    };
    BillingApi.prototype.updateActive = function (userId, cb) {
        this.getStepWithMethod('update', userId, function (err, step) {
            cb(null, !err && step === 'completed');
        });
    };
    BillingApi.prototype.update = function (userId, cb) {
        var self = this;
        jsonClient.get('/update/' + userId, function (err) {
            if (err) {
                // error 402 is one of the expected results, don't log it.
                if (err.statusCode !== 402) {
                    // build more clear error object so we wouldn't have errors: [object], [object] in the logs
                    var zuoraErr = {
                        code: err.code
                    };
                    if (err.body.errors) {
                        zuoraErr.zuoraErrors = err.body.errors;
                    }
                    if (err.body.name) {
                        zuoraErr.name = err.name;
                    }
                    self.scope.log.error(zuoraErr, 'Something went wrong with billing API');
                }
            }
            //No error handling or nothing here, just let it pass.
            cb();
        });
    };
    BillingApi.prototype.getUserLimits = function (userId, callback) {
        jsonClient.get('/limits/' + userId, callback);
    };
    return BillingApi;
})();

module.exports = BillingApi;
