'use strict';
var fs = require('fs');
var path = require('path');
var restify = require('restify');
var EventEmitter = require('events').EventEmitter;
var config = require('easy-config');

if (config.features.fileStorage === 'enabled' && (!config.fileStorage || !config.fileStorage.root)) {
    throw new Error('features.fileStorage.root is not defined in config');
}

module.exports = {
    createClient: function (call, options) {
        if (options && options.user) {
            this.user = options.user;
        } else {
            var session = call && call.req.session;
            if (session) {
                this.user = session.parentAccount || session.userName;
            } else {
                throw new Error('User session not found.');
            }
        }

        this.rootDirectory = config.fileStorage.root;
        this.mkdirp('~~/jobs');
        this.mkdirp('~~/public');
        this.mkdirp('~~/reports');
        this.mkdirp('~~/stor');
        return this;
    },
    _url: '',
    getPath: function (filepath, user) {
        if (typeof user === 'boolean') {
            user = null;
        }
        return filepath.replace(/^~~/, '/' + (user || this.user));
    },
    getFSPath: function (filepath, user) {
        return path.join(this.rootDirectory, this.getPath(filepath, user));
    },
    info: function (filepath, callback) {
        var self = this;
        fs.lstat(this.getFSPath(filepath), function (error, stats) {
            if (error) {
                return callback(new restify.NotFoundError({message: 'Resource not found'}));
            }
            var info = {
                name: path.basename(filepath),
                extension: path.extname(filepath),
                size: stats.size,
                type: stats.isDirectory() ? 'folder' : 'application/octet-stream',
                headers: {
                    'last-modified': stats.mtime.toString(),
                    'content-type': stats.isDirectory() ? 'application/x-json-stream; type=directory' : 'application/octet-stream',
                    'durability-level': 2,
                    'content-length': stats.size
                }
            };
            var rolesFile = self.getFSPath(filepath) + '._roles';
            if (fs.existsSync(rolesFile)) {
                info.headers['role-tag'] = fs.readFileSync(rolesFile, 'utf8');
            }
            callback(null, info);
        });
    },
    chattr: function (filepath, options, callback) {
        var rolesFile = this.getFSPath(filepath) + '._roles';
        fs.exists(this.getFSPath(filepath), function (exist) {
            if (exist) {
                filepath += '._roles';
                fs.writeFileSync(rolesFile, options.headers['role-tag']);
            }
            callback();
        });
    },
    mkdir: function (filepath, options, callback) {
        if (!callback) {
            callback = options;
        }
        if (!fs.existsSync(path.dirname(this.getFSPath(filepath)))) {
            return callback(new restify.NotFoundError({message: 'Resource not found'}));
        }
        try {
            fs.mkdirSync(this.getFSPath(filepath));
        } catch (ignore) {
            // ignore
        }

        if (typeof callback === 'function') {
            callback();
        }
    },
    mkdirp: function (directory, callback) {
        directory = this.getFSPath(directory);
        var parts = directory.split('/');
        var currentPath = '';
        parts.forEach(function (part) {
            currentPath = path.join('/', currentPath, part);
            try {
                fs.mkdirSync(currentPath);
            } catch (ignore) {
                // ignore error
            }
        });

        if (typeof callback === 'function') {
            callback();
        }
    },
    ls: function (filepath, callback) {
        var self = this;
        fs.readdir(this.getFSPath(filepath), function (error, files) {
            if (error) {
                return callback(new restify.NotFoundError({message: 'Resource not found'}));
            }
            var response = new EventEmitter();
            response.setEncoding = function () {};
            callback(error, response);

            files.forEach(function (file) {
                if (path.extname(file) === '._roles') {
                    return;
                }
                var lstat = fs.lstatSync(self.getFSPath(path.join(filepath, file)));
                var fileObject = {
                    name: file,
                    path: file,
                    type: lstat.isDirectory() ? 'directory' : 'object',
                    isDirectory: lstat.isDirectory(),
                    mtime: lstat.mtime.toString(),
                    size: lstat.size,
                    parent: self.getPath(filepath)
                };

                response.emit(fileObject.type, fileObject);
            });
            response.emit('end');
        });
    },
    put: function (filepath, readStream, options, callback) {
        if (options.mkdirs) {
            this.mkdirp(path.dirname(filepath));
        }

        var writeStream = fs.createWriteStream(this.getFSPath(filepath), {});
        readStream.pipe(writeStream);
        writeStream.on('error', function (error) {
            if (error.code === 'ENOSPC') {
                error.message = 'There is no free disk space. See your administrator.';
                error.statusCode = 507;
            }
            callback(error);
        });
        writeStream.on('finish', callback);
    },
    unlink: function (filepath, callback) {
        fs.unlink(this.getFSPath(filepath), function () {
            callback();
        });
    },
    rmr: function (filepath, options, callback) {
        if (typeof options === 'function') {
            callback = options;
        }
        callback = callback || new Function();
        if (!fs.existsSync(this.getFSPath(filepath))) {
            return callback();
        }
        var self = this;
        var fsPath = this.getFSPath(filepath);
        var stat = fs.lstatSync(fsPath);
        if (stat.isFile()) {
            return fs.unlinkSync(fsPath);
        }

        var files = fs.readdirSync(fsPath);
        files.forEach(function (file) {
            self.rmr(path.join(filepath, file));
        });
        fs.rmdirSync(fsPath);
        callback();
    },
    get: function (filepath, callback) {
        var self = this;
        fs.lstat(this.getFSPath(filepath), function (error, info) {
            if (error) {
                return callback(new restify.NotFoundError({message: 'Resource not found'}));
            }
            if (info.isDirectory()) {
                self.ls(filepath, callback);
            } else {
                var readStream = fs.createReadStream(self.getFSPath(filepath));
                callback(null, readStream);
            }
        });
    },
    ln: function (from, to, callback) {
        from = this.getFSPath(from);
        to = this.getFSPath(to);

        if (!fs.existsSync(from)) {
            return callback(new restify.NotFoundError({message: 'Resource not found'}));
        }

        if (!fs.existsSync(path.dirname(to))) {
            return callback(new restify.NotFoundError({message: 'Destination path does not exist'}));
        }

        if (fs.existsSync(to)) {
            return callback();
        }

        fs.link(from, to, function (error) {
            if (error && error.code === 'EEXIST') {
                error = null;
            }
            callback(error);
        });
    },
    ftw: function (filepath, options, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        callback = callback || new Function();

        var self = this;
        var emitter = new EventEmitter();
        var finished = false;
        emitter.setEncoding = function () {};
        var processes = 0;

        var finish = function finish() {
            if (finished) {
                return;
            }
            processes -= 1;
            if (processes === 0) {
                finished = true;
                emitter.emit('end');
            }
        };

        var emit = function (name, data) {
            if (!finished) {
                emitter.emit(name, data);
            }
        };

        var listDirectory = function listDirectory(dir) {
            processes += 1;
            self.ls(dir, function (error, response) {
                if (error) {
                    emit('error', error);
                    finished = true;
                    return;
                }
                response.on('directory', function (directory) {
                    emit('entry', directory);
                    listDirectory(path.join(directory.parent, directory.name));
                });
                response.on('object', function (file) {
                    emit('entry', file);
                });
                response.on('end', finish);
            });
        };

        callback(null, emitter);
        listDirectory(filepath);
    },
    exist: function (filepath) {
        return fs.existsSync(this.getFSPath(filepath));
    },
    close: function (callback) {
        if (typeof callback === 'function') {
            callback();
        }
    },
    job: function (job, opts, callback) {
        if (typeof opts === 'function') {
            callback = opts;
        }
        callback = callback || new Function();
        callback('Jobs are not implement for fileStorage');
    },
    createJob: function (job, opts, callback) {
        return this.job(job, opts, callback);
    },
    cancelJob: function (job, opts, callback) {
        return this.job(job, opts, callback);
    },
    endJob: function (job, opts, callback) {
        return this.job(job, opts, callback);
    },
    listJobs: function (opts, callback) {
        return this.job({}, opts, callback);
    },
    jobs: function (opts, callback) {
        return this.listJobs(opts, callback);
    },
    addJobKey: function (job, key, opts, callback) {
        return this.job(job, opts, callback);
    },
    jobInput: function (job, opts, callback) {
        return this.job(job, opts, callback);
    },
    jobOutput: function (job, opts, callback) {
        return this.job(job, opts, callback);
    },
    jobFailures: function (job, opts, callback) {
        return this.job(job, opts, callback);
    },
    jobErrors: function (job, opts, callback) {
        return this.job(job, opts, callback);
    },
    jobShare: function (job, opts, callback) {
        return this.job(job, opts, callback);
    },
    medusaAttach: function (job, opts, callback) {
        return this.job(job, opts, callback);
    },
    signURL: function (opts, callback) {
        callback('Sign methods are not implement for fileStorage');
    },
    createWriteStream: function (filepath, opts) {
        return fs.createWriteStream(this.getFSPath(filepath), opts);
    },
    createReadStream: function (filepath, opts) {
        return fs.createReadStream(this.getFSPath(filepath), opts);
    }
};
