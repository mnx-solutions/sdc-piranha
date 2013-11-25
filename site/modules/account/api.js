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

    function _nextStep(step) {
        return (step === 'completed' || step === 'complete') ?  step : steps[steps.indexOf(step)+1];
    }

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
                state = 'phone'; // which means billing
            }

            cb(null, state);
        });
    }

    function searchFromList(list, resp) {
        return Object.keys(list).some(function(key) {
            if (list[key].fingerprint === resp.fingerprint) {
                return true;
            }
            return undefined;
        });
    }

    api.addSshKey = function (req, name, keyData, cb) {
        req.cloud.createKey({name: name, key: keyData}, function (err, resp) {
            if(err) {
                cb(err);
                return;
            }

            // hold this call until cloudApi really has this key in the list
            (function checkList() {
                req.cloud.listKeys({login: 'my'}, function(listError, data) {
                    if(searchFromList(data, resp)) {
                        cb(null);
                    } else {
                        setTimeout(checkList, 2000);
                    }
                }, true);
            })();
        });
    };

    api.getAccountVal = function (req, cb) {
        var start = Date.now();
        if (req.session.userId) {
            getFromBilling('provision', req.session.userId, function (err, state) {
                req.log.debug('Checking with billing server took ' + (Date.now() - start) +'ms');
                cb(err, state);
            });
            return;
        }

        req.cloud.getAccount(function (accErr, account) {
            if (accErr) {
                req.log.error('Failed to get info from cloudApi', accErr);
                cb(accErr);
                return;
            }

            var now = Date.now();
            getFromBilling('provision', account.id, function (err, state) {
                req.log.debug('Checking with billing server took ' + (Date.now() - now) +'ms');
                cb(err, state);
            });
        });
    };

    api.getSignupStep = function (call, cb) {
        var req = (call.done && call.req) || call;
        req.log.trace('Getting signup step');
        function end(step) {
            req.log.trace('User landing in step:', _nextStep(step));
            cb(null, step);
        }

        if (req.session.signupStep) {
            req.log.trace('Got signup step from session: %s', req.session.signupStep);
            setImmediate(end.bind(end, req.session.signupStep));
            return;
        }
        function getMetadata(userId) {
            metadata.get(userId, metadata.SIGNUP_STEP, function (err, storedStep) {
                if (!err && storedStep) {
                    req.log.debug('Got signupStep from metadata: %s; User landing in step: %s',
                        storedStep, _nextStep(storedStep));

                    end(storedStep);
                    return;
                }

                api.getAccountVal(req, function (accountError, value) {
                    if (accountError) {
                        req.log.error(accountError, 'Got error from billing-api');
                        cb(accountError);
                        return;
                    }

                    req.log.debug('Got signup step from billing-api: %s; User landing in step: %s',
                        value, _nextStep(value));
                    
                    end(value);
                });
            });
        }
        if(req.session.userId) {
            getMetadata(req.session.userId);
            return;
        }

        req.cloud.getAccount(function (accErr, account) {
            if (accErr) {
                req.log.error(accErr, 'Failed to get info from cloudApi');
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
                metadata.set(req.session.userId, metadata.SIGNUP_STEP, step, function () {
                    call.log.info('Set signup step in metadata to %s and move to %s', step, _nextStep(step));
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
                    req.log.error('Failed to get info from cloudApi', accErr);
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

    api.safeSetSignupStep = function (call, step, cb) {
        function updateStep(req) {
            function update(userId) {
                getFromBilling('update', userId, function (err, bStep) {

                    // No errors possible currently

                    step = bStep === 'completed' ? bStep : step;

                    metadata.set(userId, metadata.SIGNUP_STEP, step, function (setError) {
                        call.log.info('Set signup step in metadata to %s', bStep);
                        cb(setError);
                    });
                });
            }

            if (req.session.userId) {
                update(req.session.userId);
                return;
            }

            req.cloud.getAccount(function (accErr, account) {
                if (accErr) {
                    req.log.error('Failed to get info from cloudApi', accErr);
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
            api.setSignupStep(call, step, cb);
        });
    };

    register('SignupProgress', api);
};
