'use strict';

var config = require('easy-config');
var restify = require('restify');
var metadata = require('./lib/metadata');

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
    register('Metadata', metadata);

    //Compatibility with old version
    var api = {};
    var steps = [ 'start', 'phone', 'billing', 'ssh' ];

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

    api.addSshKey = function (req, name, keyData, cb) {
        req.cloud.createKey({name: name, key: keyData}, function (err, resp) {
            if(err) {
                cb(err);
                return;
            }

            api.getSignupStep(req, function(err, step) {
                if(step !== 'completed' || step !== 'complete') {
                    api.setMinProgress(req, 'ssh', function(err) {
                        if(err) {
                            cb(err);
                        }

                        cb(null);
                    });
                } else {
                    cb(null);
                }
            });
        });
    };

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

            var start = Date.now();
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
            scope.log.trace('signup step is %s', step);
            cb(null, step);
        }

        if (req.session.signupStep) {
            setImmediate(end.bind(end, req.session.signupStep));
            return;
        }
        function getMetadata(userId) {
            metadata.get(userId, 'signupStep', function (err, storedStep) {
                if (!err && storedStep) {
                    call.log.info('Got signupStep from metadata', {step: storedStep});
                    end(storedStep);
                } else {
                    api.getAccountVal(req, function (err, value) {
                        if (err) {
                            cb(err);
                            return;
                        }
                        end(value);
                    });
                }
            });
        }
        if(req.session.userId) {
            getMetadata(req.session.userId);
            return;
        }

        req.cloud.getAccount(function (accErr, account) {
            if (accErr) {
                scope.log.error('Failed to get info from cloudApi', accErr);
                cb(accErr);
                return;
            }
            req.session.userId = account.id;
            getMetadata(account.id);
        });
    };

    api.setSignupStep = function (call, step, cb) {
        function updateStep(req) {
            if (req.session) {
                metadata.set(req.session.userId, 'signupStep', step, function () {
                    call.log.info('Set signupStep in metadata', {step: step});
                });
            }
            // Billing server is updated on billing step and forward
            if (steps.indexOf(step) >= steps.indexOf('billing')) {
                updateBilling(req);
            } else {
                setImmediate(cb);
            }
        }

        function updateBilling(req) {
            function update(userId) {
                jsonClient.get('/update/' + userId, function (err) {
                    if (err) {

                        // error 402 is one of the expected results, don't log it.
                        if (err.code !== 402) {

                            // build more clear error object so we wouldn't have errors: [object], [object] in the logs
                            var zuoraErr = {
                                code: err.code
                            };

                            if(err.body.errors) {
                                zuoraErr.zuoraErrors = err.body.errors;
                            }
                            if(err.body.name) {
                                zuoraErr.name = err.name;
                            }

                            call.log.error(zuoraErr,'Something went wrong with billing API');
                        }
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
            updateStep(call);
        } else {
            call.session(function (req) {
                req.session.signupStep = step;
                req.session.save();
            });
            updateStep(call.req);
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
                scope.log.debug('Can\'t move to the next step, returning');
                cb();
                return;
            }

            if (steps.indexOf(step) === (steps.length -1)) { // Last step
                step = 'completed';
            }

            scope.log.info('Step \'%s\' is now passed', step);
            api.setSignupStep(call, step, cb);
        });
    };

    register('SignupProgress', api);
};
