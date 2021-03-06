'use strict';

var config = require('easy-config');
var manta = require('manta');
var fileStorage = require('./file-storage');
var fs = require('fs');
var MemoryStream = require('memorystream');
var vasync = require('vasync');
var apiKey = fs.readFileSync(config.cloudapi.keyPath, 'utf8');
var mantaPrivateKey;

if (config.features.manta === 'enabled' && config.manta.privateKey) {
    mantaPrivateKey = fs.readFileSync(config.manta.privateKey, 'utf8');
}

exports.init = function execute(log, config, done) {
    function safeUnlink(filePath, callback) {
        var self = this;
        var retries = 5;
        var unlink = function unlink() {
            var needRetry = function (error) {
                if (error && (error.statusCode !== 410 || error.statusCode !== 404)) {
                    retries -= 1;
                    if (retries >= 0) {
                        setImmediate(function () {
                            unlink(filePath, callback);
                        });
                    } else {
                        callback(error);
                    }

                    return true;
                }
            };

            self.unlink(filePath, function (error) {
                if (needRetry(error)) {
                    return;
                }

                self.info(filePath, function (error) {
                    if (needRetry(error)) {
                        return;
                    }
                    callback();
                });
            });
        };

        unlink();
    }

    function safeMkdirp(directory, opts, callback) {
        var self = this;
        var parts = directory.split('/');
        var root = parts.slice(0, 2).join('/');
        parts = parts.splice(2);
        if (!parts.slice(-1)) {
            parts.splice(-1, 1);
        }
        var parentRoles = '';
        function waitForCreating(directory, callback, retries) {
            retries = retries !== undefined ? retries : 10;
            self.info(directory, function (err) {
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
                return function (input, funcsCallback) {
                    directory = directory + '/' + nextDirectory;
                    createDirectoryIfNotExist(directory, funcsCallback);
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
        var buffer = new Buffer(data);
        var fileStream = new MemoryStream();
        this.put(filepath, fileStream, {size: buffer.length, mkdirs: true}, callback);
        fileStream.write(buffer);
        fileStream.end();
    }

    function safePutFileContents(filepath, data, callback) {
        var directory = filepath.substr(0, filepath.lastIndexOf('/'));
        var self = this;
        this.safeMkdirp(directory, {}, function (err) {
            if (err) {
                return callback(err);
            }
            data = typeof data === 'string' ? data : JSON.stringify(data);
            var fileStream = new MemoryStream();
            self.put(filepath, fileStream, {size: data.length}, callback);
            fileStream.write(data);
            fileStream.end();
        });
    }

    function jobInfo(jobId, opts, callback) {
        if (typeof (opts) === 'function') {
            callback = opts;
            opts = {};
        }
        var self = this;
        self.job(jobId, opts, function (error) {
            if (!error || error.statusCode !== 404) {
                return callback.apply(this, arguments);
            }
            self.getFileContents('~~/jobs/' + jobId + '/job.json', callback);
        });
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

    function getFileJson(filePath, callback) {
        this.getFileContents(filePath, function (error, file) {
            if (error && error.statusCode !== 404) {
                return callback(error, []);
            }
            try {
                file = JSON.parse(file);
            } catch (e) {
                file = [];
            }
            callback(null, file);
        });
    }

    function createClient(call, opts) {
        var privateKey = opts && opts.privateKey || mantaPrivateKey;
        var userConfig = opts || config.manta;
        var session = call && call.req.session;
        var options = {
            agent: false,
            sign: manta.privateKeySigner({
                key: apiKey,
                keyId: config.cloudapi.keyId,
                user: config.cloudapi.username
            }),
            headers: {},
            url: config.manta.url,
            insecure: true,
            rejectUnauthorized: false
        };
        if (session) {
            if (session.parentAccountError) {
                options.sign = function (str, callback) {
                    callback(session.parentAccountError);
                };
            } else if (session.parentAccount) {
                options.subuser = session.userName + '/' + session.parentAccount;
                options.user = session.parentAccount;
            } else {
                options.user = session.userName;
            }
        }

        if (privateKey) {
            options.sign = manta.privateKeySigner({
                key: privateKey,
                keyId: userConfig.keyId,
                user: userConfig.user,
                subuser: userConfig.subuser
            });
            options.subuser = config.manta.subuser;
        } else {
            options.headers['X-Auth-Token'] = session.token || call.req.cloud._token;
        }
        var client;
        if (config.features.fileStorage === 'enabled') {
            client = fileStorage.createClient(call, opts);
        } else {
            client = manta.createClient(options);
        }

        client.getFileContents = getFileContents;
        client.putFileContents = putFileContents;
        client.safeMkdirp = safeMkdirp;
        client.safePutFileContents = safePutFileContents;
        client.safeUnlink = safeUnlink;
        client.setRoleTags = setRoleTags;
        client.getRoleTags = getRoleTags;
        client.listDirectory = listDirectory;
        client.getFileJson = getFileJson;
        client.jobInfo = jobInfo;
        return client;
    }

    var api = {};

    api.createClient = createClient;

    exports.MantaClient = api;
    done();
};
