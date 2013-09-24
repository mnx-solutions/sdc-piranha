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
        url: config.billing.url
    });
}

module.exports = function execute(scope, register) {
    register('Metadata', require('./lib/metadata'));

    //Compatibility with old version
    var api = {};
    var steps = [ 'start', 'phone', 'billing','ssh' ];

    function getFromBilling(method, userId, cb) {
        jsonClient.get('/' + method + '/' + userId, function (err, req, res, obj) {
            if (!err) {
                scope.log.debug('zuora(%s) allows provision', method);
                cb(null, 'completed'); // Can provision so we let through
                return;
            }

            if (!obj) {
                scope.log.warn('zuora didnt respond, allowing through');
                cb(null, 'completed'); // Can provision so we let through
                return;
            }

            scope.log.debug({obj: obj, method: method}, 'got error from zuora, handling it' );

            if (obj.errors && obj.errors[0].code === 'U01' && method === 'provision') {
                scope.log.debug('checking update method');

                getFromBilling('update', userId, cb);
                return;
            }

            var errs = obj.errors.filter(function (el) {
                return el.code !== 'U01';
            });

            var state = 'start';
            if (errs.length === 0) { // The only error was provisioning flag - letting through
                state = 'completed';
            } else if (errs.length === 1 && errs[0].code.charAt(0) === 'Z') { // There was only a billing error
                state = 'billing';
            }

            cb(null, state);
        });
    }

    api.getAccountVal = function (req, cb) {
        var start = Date.now();
        if (req.session.userId) {
            getFromBilling('provision', req.session.userId, function (err, state) {
                scope.log.debug('Checking with billing server took ' + (Date.now() - start) +'ms');
                cb(err, state);
            });
            return;
        }

        req.cloud.getAccount(function (accErr, account) {
            if (accErr) {
                scope.log.error('Failed to get info from cloudApi', accErr);
                cb(accErr);
                return;
            }

            getFromBilling('provision', account.id, function (err, state) {
                scope.log.debug('Checking with billing server took ' + (Date.now() - start) +'ms');
                cb(err, state);
            });
        });
    };

    api.getSignupStep = function (call, cb) {
        scope.log.trace('getting signup step');

        var req = (call.done && call.req) || call;

        function end(step) {
            if (steps.indexOf(step) === (steps.length - 1)) {
                step = 'completed';
            }

            scope.log.trace('signup step is %s', step);
            cb(null, step);
        }

        if (req.session.signupStep) {
            end(req.session.signupStep);
            return;
        }

        api.getAccountVal(req, function (err, value) {
            if (err) {
                cb(err);
                return;
            }

            end(value);
        });
    };

    api.setSignupStep = function (call, step, cb) {
        function updateBilling(req) {
            if (step !== 'billing') {
                return; // no zuora account yet created
            }
            function update(userId) {
                jsonClient.get('/update/' + userId, function (err) {
                    if (err) {
                        // build more clear error object so we wouldn't have errors: [object], [object] in the logs
                        var zuoraErr = {
                            code: err.code
                        };

                        if(err.body.errors)
                            zuoraErr.zuoraErrors = err.body.errors;

                        if(err.body.name)
                            zuoraErr.name = err.name;

                        call.log.error(zuoraErr,'Something went wrong with billing API');
                    }
                    //No error handling or nothing here, just let it pass.
                    cb();
                });
            }

            if (req.session.userId) {
                update(req.session.userId);
                return;
            }

            req.cloud.getAccount(function (accErr, account) {
                if (accErr) {
                    scope.log.error('Failed to get info from cloudApi', accErr);
                    cb(accErr);
                    return;
                }

                update(account.id);
            });
        }

        if (!call.req && !call.done) { // Not a call, but request
            call.session.signupStep = step;
            call.session.save();
            updateBilling(call);
        } else {
            call.session(function (req) {
                req.session.signupStep = step;
                req.session.save();
            });
            updateBilling(call.req);
        }
    };

    api.setMinProgress = function (call, step, cb) {
        api.getSignupStep(call, function (err, oldStep) {
            if (err) {
                cb(err);
                return;
            }

            var isCompleted = oldStep === 'completed' || oldStep === 'complete';
            var isAStepBackwards = steps.indexOf(step) <= steps.indexOf(oldStep);
            var isALeap = steps.indexOf(step) - steps.indexOf(oldStep) > 1;

            if (isCompleted || isAStepBackwards || isALeap) {
                cb();
                return;
            }

            if (steps.indexOf(step) === (steps.length -1)) { // Last step
                step = 'completed';
            }

            api.setSignupStep(call, step, cb);
        });
    };

    register('SignupProgress', api);
};