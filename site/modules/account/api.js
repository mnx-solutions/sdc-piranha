'use strict';

var metadata = require('./lib/metadata');
var BillingApi = require('./lib/billing');

exports.Metadata = metadata;

exports.init = function execute(log, config, done) {
    var Billing = new BillingApi({log: log});
    exports.Billing = Billing;

    //Compatibility with old version
    var api = {};
    var steps = ['start', 'phone', 'billing', 'ssh'];
    if (config.features.phoneVerification !== 'enabled') {
        steps.splice(steps.indexOf('phone'), 1);
    }

    function _nextStep(step) {
        return (step === 'completed' || step === 'complete') ?  step : steps[steps.indexOf(step) + 1];
    }

    function searchFromList(list, resp) {
        return Object.keys(list).some(function (key) {
            if (list[key].fingerprint === resp.fingerprint) {
                return true;
            }
            return undefined;
        });
    }

    api.addSshKey = function (req, name, keyData, cb) {
        req.cloud.createKey({name: name, key: keyData}, function (err, resp) {
            if (err) {
                cb(err);
                return;
            }

            // hold this call until cloudApi really has this key in the list
            (function checkList() {
                req.cloud.listKeys({login: 'my'}, function (listError, data) {
                    if (listError) {
                        req.log.error('Failed to get listKeys from cloudApi', listError);
                        cb(null);
                    } else if (searchFromList(data, resp)) {
                        cb(null);
                    } else {
                        setTimeout(checkList, 2000);
                    }
                }, true);
            })();
        });
    };
    api.addSubUserSshKey = function (req, name, keyData, cb) {
        var userId = req.body.subUser || req.query.userId;
        req.cloud.uploadUserKey(userId, {name: name, key: keyData}, function (err, resp) {
            if (err) {
                cb(err);
                return;
            }

            //hold this call until cloudApi really has this key in the list
            (function checkList() {
                req.cloud.listUserKeys('my', userId, function (listError, data) {
                    if (listError) {
                        req.log.error('Failed to get listUserKeys from cloudApi', listError);
                        cb(null);
                    } else if (searchFromList(data, resp)) {
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
            Billing.getStep(req.session.userId, function (err, state) {
                req.log.debug('Checking with billing server took ' + (Date.now() - start) + 'ms');
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
            Billing.getStep(account.id, function (err, state) {
                req.log.debug('Checking with billing server took ' + (Date.now() - now) + 'ms');
                cb(err, state);
            });
        });
    };

    api.getSignupStep = function (call, cb) {
        var req = (call.done && call.req) || call;
        req.log.trace('Getting signup step');
        function end(step) {
            //TODO: Signup can be removed altogether once allowSkipBilling becomes permanently enabled
            if (step !== 'blocked' && config.features.allowSkipBilling === 'enabled') {
                step = 'completed';
            }
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
                if (err) {
                    if (config.features.allowSkipBilling === 'enabled' && req.session.userIsNew) {
                        metadata.set(userId, metadata.SIGNUP_STEP, 'completed', function (err) {
                            if (err) {
                                req.log.info('Failed to set completed signup step in metadata');
                            }
                        });
                    } else if (!req.session.parentAccountError) {
                        req.log.error({error: err}, 'Cannot get signup step from metadata');
                    } else {
                        req.log.error(req.session.parentAccountError);
                    }
                } else if (storedStep) {
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
        if (req.session.userId) {
            var userId = req.session.parentAccountId || req.session.userId;
            getMetadata(userId);
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
        function updateBilling(req) {
            if (req.session.userId) {
                Billing.update(req.session.userId, cb);
                return;
            }
            req.cloud.getAccount(function (accErr, account) {
                if (accErr) {
                    req.log.error('Failed to get info from cloudApi', accErr);
                    cb(accErr);
                    return;
                }

                Billing.update(account.id, cb);
            });
        }

        function updateStep(req) {
            if (req.session) {
                metadata.set(req.session.userId, metadata.SIGNUP_STEP, step, function (metaErr) {
                    if (metaErr) {
                        call.log.error(metaErr);
                    } else {
                        call.log.info('Set signup step in metadata to %s and move to %s', step, _nextStep(step));
                    }
                    if (step === 'blocked') {
                        updateBilling(req);
                    }
                });
            }
            // Billing server is updated on billing step and forward
            if (steps.indexOf(step) >= steps.indexOf('billing') || step === 'completed') {
                updateBilling(req);
            } else if (!req.session || step !== 'blocked') {
                setImmediate(cb);
            }
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
            if (steps.indexOf(oldStep) === -1 && oldStep !== 'blocked') {
                oldStep = 'start';
            }
            var isAStepBackwards = steps.indexOf(step) <= steps.indexOf(oldStep);
            var isALeap = steps.indexOf(step) - steps.indexOf(oldStep) > 1;

            if (isCompleted || isAStepBackwards || isALeap) {
                log.debug('Can\'t move to the next step, returning');
                cb();
                return;
            }

            if (steps.indexOf(step) === (steps.length - 1)) { // Last step
                step = 'completed';
            }
            api.setSignupStep(call, step, cb);
        });
    };

    api.getCurrentStep = function (req) {
        return _nextStep(req.session.signupStep);
    };

    api.sendSshResponse = function (req, res) {
        var result = {
            success: true
        };
        if (req.session.redirectUrl) {
            result.redirectUrl = req.session.redirectUrl;
        }
        res.json(result);
    };
    exports.SignupProgress = api;
    done();
};
