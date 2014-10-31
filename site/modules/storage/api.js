"use strict";

var config = require('easy-config');
var manta = require('manta');
var fs = require('fs');
var MemoryStream = require('memorystream');
var vasync = require('vasync');

module.exports = function execute(scope, register) {
    function getFileContents(filepath, encoding, callback) {
        if (!callback) {
            callback = encoding;
        }
        this.get(filepath, function (error, stream) {
            if (error) {
                callback(error);
                return;
            }
            var data = '';
            stream.setEncoding('utf8');
            stream.on('data', function (chunk) {
                data += chunk;
            });
            stream.on('end', function () {
                callback(null, data);
            });
            stream.on('error', function (err) {
                callback(err);
            });
        });
    }

    function putFileContents(filepath, data, callback) {
        data = typeof data === 'string' ? data : JSON.stringify(data);
        var fileStream = new MemoryStream(data);
        this.put(filepath, fileStream, {size: data.length, mkdirs: true}, callback);
    }

    function setRoleTags(path, roles, recursive, callback) {
        roles = roles || [];
        var chattrOpts = {
            headers: {'role-tag': roles.join(',') }
        };
        var chunkSize = 50;
        var self = this;
        var queue = vasync.queue(function (entry, callback) {
            var fullPath = entry;
            if (path !== entry) {
                fullPath = entry.parent + '/' + entry.name;
            }
            self.chattr(fullPath, chattrOpts, callback);
        }, chunkSize);

        var tagSelf = function () {
            queue.push(path);
            queue.drain = function () {
                callback(null);
            };
        };

        if (recursive) {
            this.ftw(path, function (err, res) {
                if (err) {
                    return callback(err);
                }

                res.on('entry', function (obj) {
                    queue.push(obj);
                });

                res.on('end', tagSelf);

                res.on('error', function (error) {
                    callback(error);
                });
            });
        } else {
            tagSelf();
        }
    }

    function createClient(call) {

        var options = {
            sign: manta.privateKeySigner({
                key: fs.readFileSync(config.cloudapi.keyPath, 'utf8'),
                keyId: config.cloudapi.keyId,
                user: config.cloudapi.username
            }),
            headers: {},
            url: config.manta.url,
            insecure: true,
            rejectUnauthorized: false
        };
        if (call.req.session.parentAccountError) {
            options.sign = function (str, callback) {
                callback(call.req.session.parentAccountError);
            };
        } else if (call.req.session.parentAccount) {
            options.subuser = call.req.session.userName + '/' + call.req.session.parentAccount;
            options.user = call.req.session.parentAccount;
        } else {
            options.user = call.req.session.userName;
        }

        if (config.manta.privateKey) {
            options.sign = manta.privateKeySigner({
                key: fs.readFileSync(config.manta.privateKey, 'utf8'),
                keyId: config.manta.keyId,
                user: config.manta.user
            });
        } else {
            options.headers['X-Auth-Token'] = call.req.session.token || call.req.cloud._token;
        }
        var client = manta.createClient(options);
        client.getFileContents = getFileContents;
        client.putFileContents = putFileContents;
        client.setRoleTags = setRoleTags;
        return client;
    }

    var api = {};

    api.createClient = createClient;

    register('MantaClient', api);
};