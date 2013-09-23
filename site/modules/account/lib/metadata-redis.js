'use strict';

var config = require('easy-config');
var redis = require('redis');
var redisClient = redis.createClient(config.redis.port, config.redis.host);
redisClient.auth(config.redis.password, function() {});

var get = function (uuid, key, callback) {
    redisClient.hget('metadata:' + uuid, key, callback);
};

var set = function (uuid, key, value, callback) {
    redisClient.hset('metadata:' + uuid, key, value, callback);
};

module.exports = {
    get: get,
    set: set
};