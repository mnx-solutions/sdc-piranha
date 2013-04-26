'use strict';

var redis = require('redis');
var config = require('easy-config');

module.exports = function (scope, register, callback) {
    var api = {};
    api.client = redis.createClient({host: config.redis.host, port: config.redis.port});

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
                return cb(accErr);
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
                api.setTokenVal(account.login, data, function (setErr) {
                    if(setErr) {
                        scope.log.error('Failed to set value in db', setErr);
                    }
                    cb(setErr, data);
                });
            });
        });
        return;
    };

    api.setTokenVal = function (token, val, expires, cb) {
        if (!cb) {
            cb = expires;
            expires = false;
        }

        api.client.set(token, val, function (err) {
            if(err) {
                scope.log.error('Failed to set value in db', err);
                cb(err);
                return;
            }
            if(!expires) {
                cb();
                return;
            }
            api.client.setex(token, (24*60*60), function (setexErr) {
                if(setexErr) {
                    scope.log.error('Failed to setex for value', setexErr);
                }
                cb();
                return;
            });
        });
    };

    register('SignupProgress', api);

    api.client.select(config.redis.signupDB, function () {
        callback();
    });
};