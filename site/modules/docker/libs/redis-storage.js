'use strict';
var redis = require('redis');
var config = require('easy-config');
var vasync = require('vasync');
var util = require('util');
var SEPARATOR = ':';
var PREFIX = 'docker';
var LABELS = 'labels';

var extendLabels = function (collectorLabels, source) {
    Object.keys(source || {}).forEach(function (key) {
        collectorLabels[key] = collectorLabels[key] || [];
        var value = source[key];
        if (collectorLabels[key].indexOf(value) === -1) {
            collectorLabels[key].push(value);
        }
    });
};

function RedisStorage(call) {
    var password = config.redis.password;

    this.requestId = call.id;
    this.client = redis.createClient(config.redis.port, config.redis.host);
    if (password) {
        this.client.auth(password);
    }
    this.client.select(config.redis.db);
    this.log = call.log;
    this.userId = call.req.session.userId;
}

RedisStorage.prototype.collectors = {};

RedisStorage.prototype.quit = function () {
    this.client.quit();
};

RedisStorage.prototype.getKey = function (key) {
    return [PREFIX, this.userId, key].join(SEPARATOR);
};

RedisStorage.prototype.exists = function (key, callback) {
    this.client.exists(this.getKey(key), callback);
};

RedisStorage.prototype.get = function (key, callback) {
    this.client.get(this.getKey(key), function (error, data) {
        if (error) {
            return callback(error);
        }
        try {
            data = JSON.parse(data);
        } catch (e) {
            data = {};
        }

        callback(null, data);
    });
};

RedisStorage.prototype.set = function (key, value, callback) {
    callback = callback || function () {};
    value = typeof value === 'string' ? value : JSON.stringify(value);
    this.client.set(this.getKey(key), value, callback);
};

RedisStorage.prototype.del = function (key, callback) {
    callback = callback || function () {};
    this.client.del(this.getKey(key), callback);
};

RedisStorage.prototype.getUserCollector = function (name, create) {
    var userCollectors = this.collectors[this.userId] = this.collectors[this.userId] || {};
    if (create && name) {
        userCollectors[name] = userCollectors[name] || {};
    }
    return name ? userCollectors[name] : userCollectors;
};

RedisStorage.prototype.getCollector = function () {
    var self = this;
    var userCollectors = this.getUserCollector(LABELS, true);
    var collector = userCollectors[this.requestId] = userCollectors[this.requestId] || {
            labels: {},
            pool: [],
            complete: function () {
                self.set(LABELS, this.labels);
                self.quit();
            },
            collect: function () {
                // jscs:disable safeContextKeyword
                var collector = this;
                // jscs:enable safeContextKeyword
                var entry = this.pool.shift();
                if (!entry) {
                    return self.get(LABELS, function (error, labels) {
                        self.set(LABELS, util._extend(collector.labels, labels));
                        delete self.collectors[self.userId][LABELS][self.requestId];
                        collector.complete();
                    });
                }
                var containerId = entry.container.Id;
                self.get(containerId, function (error, labels) {
                    if (labels) {
                        extendLabels(collector.labels, labels);
                        return collector.collect();
                    }
                    entry.client.inspect({id: containerId}, function (error, info) {
                        if (error) {
                            return collector.collect();
                        }
                        var containerLabels = info.Config && info.Config.Labels;
                        extendLabels(collector.labels, containerLabels);
                        self.set(containerId, containerLabels);
                        collector.collect();
                    });
                });
            }
        };
    return collector;
};

RedisStorage.prototype.saveContainersLabels = function (containers, dockerClient) {
    if (!containers.length) {
        return;
    }

    var collector = this.getCollector();
    containers.forEach(function (container) {
        collector.pool.push({container: container, client: dockerClient});
    });
    collector.collect();
};

RedisStorage.prototype.loadContainersLabels = function (callback) {
    this.get(LABELS, callback);
    this.quit();
};

module.exports = RedisStorage;
