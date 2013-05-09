'use strict';

var redis = require('redis');
var config = require('easy-config');

module.exports = function (scope, register, callback) {
    var api = {};

    api.client = redis.createClient(config.redis.port, config.redis.host);
    api.client.on('error', function (err) {

    });

    var steps = ['start', 'accountInfo', 'tropo', 'billing', 'ssh'];

    if(!config.redis.signupDB) {
        scope.log.fatal('Redis config missing');
        process.exit();
    }

    api.getTokenVal = function (token, cb) {
        api.client.get(token, function (err, val) {
            if(err) {
                scope.log.error('Failed to connect to redis', err);
                //TODO: Figure out how to do error handling here,
                // should we assume client has passed all or simply refuse to move on.
                return cb(err);
            }
            cb(null, val);
        });
    };

    api.getAccountVal = function (cloud, cb) {
        cloud.getAccount(function (accErr, account) {
            if(accErr) {
                scope.log.error('Failed to get info from cloudApi', accErr);
                cb(accErr);
                return;
            }
            api.getTokenVal(account.login, function (err2, data) {
                if(err2) {
                    //TODO: Figure out how to do error handling here,
                    // should we assume client has passed all or simply refuse to move on.
                    return cb(err2);
                }
                if(data) {
                    cb(null, data);
                    return;
                }
                data = 'start';
                api.setAccountVal(account.login, data, function (setErr) {
                    if(setErr) {
                        scope.log.error('Failed to set value in db', setErr);
                    }
                    cb(setErr, data);
                });
            });
        });
        return;
    };

    api.setAccountVal = function (cloud, value, cb) {
        if(typeof cloud === 'string') {
            api.setTokenVal(cloud, value, cb);
            return;
        }
        cloud.getAccount(function (accErr, account) {
            if(accErr) {
                scope.log.error('Failed to get info from cloudApi', accErr);
                cb(accErr);
                return;
            }
            api.setTokenVal(account.login, value, cb);
        });
    };

    api.setTokenVal = function (token, val, expires, cb) {
        if (!cb) {
            cb = expires;
            expires = false;
        }

        if(expires) {
            api.client.setex(token, (24*60*60), val, function (setexErr) {
                if(setexErr) {
                    scope.log.error('Failed to setex for value', setexErr);
                }
                cb();
            });
            return;
        }
        api.client.set(token, val, function (err) {
            if(err) {
                scope.log.error('Failed to set value in db', err);
                cb(err);
                return;
            }
            cb();
        });
    };

    api.getSignupStep = function (req, cb) {
        if(req.session.signupStep) {
            cb(null, req.session.signupStep);
            return;
        }

        api.getTokenVal(req.session.token, function (err, val) {
            if(err) {
                cb(err);
                return;
            }
            if(val) {
                cb(null, val);
                return;
            }
            api.getAccountVal(req.cloud, function (err, value) {
                if(err) {
                    cb(err);
                    return;
                }
                api.setTokenVal(req.session.token, value, true, function (err) {
                    if(err) {
                        cb(err);
                        return;
                    }
                    cb(null, value);
                    return;
                });
            });
        });
    };

    api.setSignupStep = function (call, step, cb) {
        var count = 2;
        var errs = [];

        function end(err) {
            if(err) {
                errs.push(err);
            }
            if(--count === 0) {
                call.session(function (req) {
                    req.session.signupStep = step;
                    req.session.save();
                });
                cb((errs.length < 1 ? null : errs));
            }
        }

        api.setTokenVal(call.req.session.token, step, true, end);
        api.setAccountVal(call.req.cloud, step, end);
    };

    api.setMinProgress = function (call, step, cb) {
        if(!call.req && !call.done) { // Not a call, but request
            call = {req: call};
        }
        api.getSignupStep(call.req, function (err, oldStep) {
            if(err) {
                cb(err);
                return;
            }
            if(oldStep === 'complete' || steps.indexOf(step) <= steps.indexOf(oldStep) || (steps.indexOf(step) - steps.indexOf(oldStep) > 1)) {
                cb();
                return;
            }
            api.setSignupStep(call, step, cb);
        });
    };

    register('SignupProgress', api);

    api.client.select(config.redis.signupDB, function () {
        callback();
    });
};