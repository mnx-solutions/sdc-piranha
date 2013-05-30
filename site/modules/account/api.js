'use strict';

var config = require('easy-config');
var restify = require('restify');
var jsonClient = null;

if(!config.billing.noUpdate && config.billing.url) {
    jsonClient = restify.createJsonClient({url: config.billing.url});
}

module.exports = function execute(scope, register, callback) {
    //Compatibility with old version
    if(!jsonClient) {
        return require('./api-old.js').call(this, scope, register, callback);
    }

    var api = {};

    var steps = ['start', 'tropo', 'billing','ssh'];

    function getFromBilling(method, account, cb) {
        jsonClient.get('/' + method + '/' + account.id, function (err, req, res, obj) {
            if(!err) {
                scope.log.debug({account: account}, 'zuora(%s) allows provision', method);
                cb(null, 'completed'); // Can provision so we let through
                return;
            }
            if(!obj) {
                scope.log.warn({account: account}, 'zuora didnt respond, allowing through');
                cb(null, 'completed'); // Can provision so we let through
                return;
            }
            scope.log.debug({obj: obj, account: account, method: method}, 'got error from zuora, handling it' );

            if(obj.errors && obj.errors[0].code === 'U01' && method === 'provision') {
                scope.log.debug('checking update method');

                getFromBilling('update', account, cb);
                return;
            }

            var errs = obj.errors.filter(function (el) {
                return el.code !== 'U01';
            });
            var state = 'start';
            if(errs.length > 0) {
                if(errs.length === 1) {
                    if(errs[0].code.charAt(0) === 'Z'){
                        state = 'tropo';
                    }
                }
            } else {
                state = 'completed';
            }
            cb(null, state);
            return;
        });
    }
    api.getAccountVal = function (cloud, cb) {
        cloud.getAccount(function (accErr, account) {
            if(accErr) {
                scope.log.error('Failed to get info from cloudApi', accErr);
                cb(accErr);
                return;
            }
            var start = Date.now();
            getFromBilling('provision', account, function (err, state) {
                scope.log.debug({account: account}, 'Checking with billing server took ' + (Date.now() - start));
                cb(err, state);
            });
        });
        return;
    };

    api.getSignupStep = function (call, cb) {

        scope.log.trace('getting signup step');

        var req = (call.done && call.req) || call;

        function end(step) {
            if(steps.indexOf(step) === (steps.length - 1)) {
                step = 'completed';
            }
            scope.log.trace('signup step is %s', step);
            cb(null, step);
        }

        if(req.session.signupStep) {
            end(req.session.signupStep);
            return;
        }

        api.getAccountVal(req.cloud, function (err, value) {
            if(err) {
                cb(err);
                return;
            }
            end(value);
        });
    };

    api.setSignupStep = function (call, step, cb) {
        if(!call.req && !call.done) { // Not a call, but request
            call.session.signupStep = step;
            call.session.save();
        } else {
            call.session(function (req) {
                req.session.signupStep = step;
                req.session.save();
            });
        }
        setImmediate(cb);
    };

    api.setMinProgress = function (call, step, cb) {
        api.getSignupStep(call, function (err, oldStep) {
            if(err) {
                cb(err);
                return;
            }
            if(oldStep === 'completed' || oldStep === 'complete' || steps.indexOf(step) <= steps.indexOf(oldStep) || (steps.indexOf(step) - steps.indexOf(oldStep) > 1)) {
                cb();
                return;
            }
            if(steps.indexOf(step) === (steps.length -1)) { // Last step
                step = 'completed';
            }
            api.setSignupStep(call, step, cb);
        });
    };

    register('SignupProgress', api);
    setImmediate(callback);
};