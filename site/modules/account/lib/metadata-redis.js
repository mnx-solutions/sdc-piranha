'use strict';

var config = require('easy-config');
var redis = require('redis');
var redisClient = redis.createClient(config.redis.port, config.redis.host);
// This command is magical.  Client stashes the password and will issue on every connect.
redisClient.auth(config.redis.password);

var get = function (uuid, key, val, callback) {
    if (val instanceof Function) {
        callback = val;
    }
    redisClient.hget('metadata:' + uuid, key, callback);
};

var set = function (uuid, key, value, callback) {
    redisClient.hset('metadata:' + uuid, key, value, callback);
};

var SECURITY_KEY = 'useMoreSecurity';

module.exports = {
    get: get,
    set: set,
    getSecurity: function (uuid, callback) {
        get(uuid, SECURITY_KEY, callback);
    },
    setSecurity: function (uuid, val, callback) {
        val = val || '';
        set(uuid, SECURITY_KEY, val, callback);
    }
};