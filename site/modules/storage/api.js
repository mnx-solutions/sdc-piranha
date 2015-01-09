'use strict';

var config = require('easy-config');
var manta = require('manta');
var fs = require('fs');
var MemoryStream = require('memorystream');
var vasync = require('vasync');

module.exports = function execute(scope, register) {
    function safeMkdirp(directory, opts, callback) {
        var self = this;
        var parts = directory.split('/');
        var root = parts.slice(0, 2).join('/');
        var pipeline = [];
        parts = parts.splice(2);
        if (!parts.slice(-1)) {
            parts.splice(-1, 1);
        }
        var parentRoles = '';
        function waitForCreating(directory, callback, retries) {
            retries = retries !== undefined ? retries : 10;
            self.client.head(directory, function (err, req, res) {
                if (err) {
                    if (!retries) {
                        return callback(new Error('Directory ' + directory + ' not exist.'));
                    }
                    setTimeout(function () {
                        waitForCreating(directory, callback, --retries);
                    }, 500);
                    return;
                }
                callback();
            });
        }
        function createDirectoryIfNotExist(directory, callback) {
            self.info(directory, function (error, info) {
                if (error) {
                    if (error.statusCode === 404) {
                        var options = {
                            headers: opts.headers || {}
                        };
                        options.headers['role-tag'] = parentRoles;
                        self.mkdir(directory, options, function (error) {
                            if (error) {
                                return callback(error);
                            }
                            waitForCreating(directory, callback);
                        });
                        return;
                    }
                    return callback(error);
                }
                if (opts.copyRoles) {
                    parentRoles = info.headers['role-tag'] || '';
                }
                callback();
            });
        }
        directory = root;
        vasync.pipeline({
            funcs: parts.map(function (nextDirectory) {
                return function (input, callback) {
                    directory = directory + '/' + nextDirectory;
                    createDirectoryIfNotExist(directory, callback);
                };
            })
        }, callback);
    }

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
            headers: {'role-tag': roles.join(',')}
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

    function getRoleTags(path, callback) {
        this.info(path, function (err, info) {
            if (err) {
                return callback(err);
            }
            var roles;
            if (info.headers['role-tag']) {
                roles = info.headers['role-tag'].split(/\s*,\s*/);
            } else {
                roles = [];
            }
            callback(null, roles);
        });
    }

    function listDirectory(path, callback) {
        this.ls(path, function (err, res) {
            if (err) {
                return callback(err);
            }
            var files = [];
            function onEntry(e) {
                files.push(e);
            }

            res.on('directory', onEntry);
            res.on('object', onEntry);
            res.once('error', callback);
            res.once('end', function () {
                files.forEach(function (file) {
                    file.path = file.name;
                });
                callback(null, files);
            });
        });
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
                user: config.manta.user,
                subuser: config.manta.subuser
            });
            options.subuser = config.manta.subuser;
        } else {
            options.headers['X-Auth-Token'] = call.req.session.token || call.req.cloud._token;
        }
        var client = manta.createClient(options);
        client.getFileContents = getFileContents;
        client.putFileContents = putFileContents;
        client.safeMkdirp = safeMkdirp;
        client.setRoleTags = setRoleTags;
        client.getRoleTags = getRoleTags;
        client.listDirectory = listDirectory;
        return client;
    }

    var api = {};

    api.createClient = createClient;

    register('MantaClient', api);
};
