'use strict';

var redis = require('redis');
var config = require('easy-config');
var redisClients = {};
var redisOnHold = {};

var restify = require('restify');
var jsonClient = null;

if(!config.billing.noUpdate) {
    jsonClient = restify.createJsonClient({url: config.billing.url});
}

module.exports = function (scope, register, callback) {
    var api = {};
    var id = config.redis.host + ':' + config.redis.port + '-' + config.redis.signupDB;

    if(redisClients[id]) {
        api.client = redisClients[id];
    } else {
        api.client = redisClients[id] = redis.createClient(config.redis.port, config.redis.host);
        api.client.on('error', function (err) {

        });
    }

    var steps = ['start', 'tropo', 'billing','ssh'];

    if(!config.redis.signupDB) {
        scope.log.fatal('Redis config missing');
        process.exit();
    }

    api.getTokenVal = function (token, cb) {
//        api.client.get(token, function (err, val) {
//            if(err) {
//                scope.log.error('Failed to connect to redis', err);
//                //TODO: Figure out how to do error handling here,
//                // should we assume client has passed all or simply refuse to move on.
//                return cb(err);
//            }
//            cb(null, val);
//        });
        setImmediate(function () {
            cb(null, null);
        });
    };

    api.getAccountVal = function (cloud, cb) {
        cloud.getAccount(function (accErr, account) {
            if(accErr) {
                scope.log.error('Failed to get info from cloudApi', accErr);
                cb(accErr);
                return;
            }
            if(!jsonClient) { //Dev env
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
            } else {
                jsonClient.get('/provision/' + account.id, function (err, req, res, obj) {
                    if(!err) {
                        cb(null, 'completed'); // Can provision so we let through
                        return;
                    }
                    var state = 'start';
                    if(obj.errors && obj.errors.length === 1) {
                        if(obj.errors[0].code.charAt(0) === 'Z'){
                            state = 'tropo';
                        } else if(obj.errors[0].code === 'U01') {
                            state = 'completed';
                        }
                    }
                    cb(null, state);
                    return;

                });
            }
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
        function end(step) {
            if(steps.indexOf(step) === (steps.length - 1)) {
                step = 'completed';
            }
            cb(null, step);
        }
        if(req.session.signupStep) {
            end(req.session.signupStep);
            return;
        }

        api.getTokenVal(req.session.token, function (err, val) {
            if(err) {
                cb(err);
                return;
            }
            if(val) {
                end(val);
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
                    end(value);
                    return;
                });
            });
        });
    };

    api.setSignupStep = function (call, step, cb) {
        var count = 1;
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
//        api.setAccountVal(call.req.cloud, step, end);
    };

    api.setMinProgress = function (call, step, cb) {
        if(!call.req && !call.done) { // Not a call, but request
            var req = call;
            call = {
                req: req,
                session: function (fn) {
                    fn(req);
                }
            };
        }
        api.getSignupStep(call.req, function (err, oldStep) {
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

    if(api.client.__connected) {
        setImmediate(callback);
    } else if(api.client.__connecting) {
        redisOnHold[id].push(callback);
    } else {
        redisOnHold[id] = [callback];
        api.client.__connecting = true;
        api.client.select(config.redis.signupDB, function () {
            redisClients[id].__connected = true;
            redisOnHold[id].forEach(function (fn){
                fn();
            });
        });
    }
};