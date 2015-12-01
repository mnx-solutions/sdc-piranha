"use strict";

var vasync = require('vasync');
var path = require('path');
var config = require('easy-config');
var manta = require('manta');
var formidable = require('formidable');
var MemoryStream = require('memorystream');
var EventEmitter = require('events').EventEmitter;

module.exports = function (app) {
    var UPLOAD_ABORT_ERROR = 'write after end';
    var Manta = require('./').MantaClient;
    var uploadProgresses = Manta.uploadProgresses = {};
    var uploadFiles = {};

    var abortUploading = function (userId, formId, callback) {
        var progress = uploadProgresses[userId] && uploadProgresses[userId][formId];
        if (!progress) {
            return callback();
        }
        progress.on('complete', callback);

        Object.keys(progress.files).forEach(function (filePath) {
            var fileProgress = progress.files[filePath];
            var mantaStream = fileProgress && fileProgress.streams && fileProgress.streams.mantaStream;
            if (mantaStream) {
                mantaStream.emit('error', new Error('abort'));
            }
        });
    };

    app.post('/upload', function (req, res, next) {
        var formId;
        var form = new formidable.IncomingForm();
        var client = Manta.createClient({req: req});
        var directory = false;
        var userId = req.session.userId;
        var metadata;
        var progresses = uploadProgresses[userId] = uploadProgresses[userId] || {};
        var progress;
        var done = function done(data) {
            if (!res.headersSent) {
                res.json(data);
            }
        };

        var checkFile = function (filePath, checker, callback) {
            client.info(filePath, function (error, info) {
                if (checker(error, info)) {
                    callback(error, info);
                } else {
                    setTimeout(function () {
                        checkFile(filePath, checker, callback);
                    }, 1000);
                }
            });
        };

        var completeUploading = function (progress, filePath) {
            delete progress.files[filePath];
            if (!Object.keys(progress.files).length) {
                progress.emit('complete');
            }
        };

        var uploadFile = function uploadFile(filePath, part, callback) {
            if (uploadFiles[filePath]) {
                progress.files[filePath] = uploadFiles[filePath];
                uploadFiles[filePath].on('complete', callback);
                return;
            }
            if (progress.files[filePath]) {
                progress.files[filePath].on('complete', callback);
                return;
            }
            var fileProgress = progress.files[filePath] = new EventEmitter();

            var options = {
                size: metadata.files[part.filename],
                type: part.mime,
                headers: {
                    'max-content-length': metadata.files[part.filename]
                },
                mkdirs: true
            };
            var complete = function (error) {
                if (complete.called) {
                    req.log.trace({stack: complete.called}, 'Callback was called twice.');
                    return;
                }
                complete.called = new Error().stack;
                if (error) {
                    return client.safeUnlink(filePath, function () {
                        fileProgress.emit('complete', error, fileProgress);
                    });
                }
                fileProgress.emit('complete', error, fileProgress);
            };

            uploadFiles[filePath] = fileProgress;
            fileProgress.once('complete', function () {
                if (uploadFiles[filePath]) {
                    delete uploadFiles[filePath];
                }
            });
            fileProgress.on('complete', callback);

            var memStream = new MemoryStream();
            part.pipe(memStream);

            var mantaStream = client.createWriteStream(filePath, options);
            memStream.pipe(mantaStream);
            fileProgress.streams = {
                mantaStream: mantaStream,
                memStream: memStream
            };

            fileProgress.uploaded = 0;
            memStream.on('data', function (chunk) {
                fileProgress.uploaded += chunk.length;
            });

            mantaStream.on('error', complete);

            mantaStream.on('end', complete);
        };

        var parseMetadata = function parseMetadata(part, callback) {
            var data = '';
            part.on('data', function (chunk) {
                data += chunk;
            });
            part.on('end', function () {
                callback(null, JSON.parse(data));
            });
            part.on('error', callback);
        };

        form.setMaxListeners(0);
        form.on('error', function (err) {
            req.log.warn({err: err}, 'Incoming form error');
            done({success: false, status: 200});
        }).on('aborted', function (err) {
            req.log.warn({err: err}, 'Incoming form aborted');
            abortUploading(userId, formId, function () {
                done({success: false, status: 200});
            });
        });
        form.on('end', function () {
            done({success: true, status: 200});
        });

        form.onPart = function (part) {
            if (part.name === 'metadata') {
                parseMetadata(part, function (error, obj) {
                    if (error) {
                        return next(error);
                    }
                    metadata = obj;
                    directory = obj.path;
                    formId = obj.formId;
                    progress = progresses[formId] = progresses[formId] || new EventEmitter();
                    progress.files = progress.files || {};
                    progress.on('complete', function () {
                        delete progresses[formId];
                    });
                });
            } else if (!part.filename) {
                form.handlePart(part);
            } else if (!directory) {
                next(new Error('variable "path" should be placed in a start of multipart data'));
            } else {
                var filePath = client.path('~~/' + directory + '/' + part.filename);
                uploadFile(filePath, part, function (error) {
                    if (error) {
                        // If upload was aborted by user
                        var logLevel = 'error';
                        var suppressError = false;
                        if (error.message !== UPLOAD_ABORT_ERROR && error.message !== 'abort') {
                            if (error.name === 'NoMatchingRoleTagError' ||
                                (error.name === 'AuthorizationFailedError' || error.name === 'ForbiddenError') &&
                                error.statusCode === 403 && req.session.subId) {
                                logLevel = 'info';
                                suppressError = true;
                            }
                            req.log[logLevel]({error: error}, 'Error while uploading files');
                        }

                        if (suppressError) {
                            res.json({status: 'error', message: error.message});
                        } else if (!res.headersSent) {
                            res.status(error.statusCode || 500).send(error.message);
                        }
                    }

                    completeUploading(progress, filePath);
                });
            }
        };

        form.parse(req);
    });

    app.get('/upload/abort', function (req, res) {
        var formId = req.query.formId;
        var userId = req.session.userId;
        abortUploading(userId, formId, function () {
            res.status(200).end();
        });
    });

    var getFile = function (req, res, action) {
        var messageError;
        var headerType;
        if (action === 'download') {
            messageError = 'Error while downloading file';
            headerType = 'application/octet-stream';
        } else {
            messageError = 'Error while showing file';
            headerType = 'text/plain';
        }
        var client = Manta.createClient({req: req});
        var filePath = new Buffer(req.query.path, 'base64').toString('utf8');
        client.get(filePath, function (err, stream) {
            if (err) {
                req.log.error({error: err}, messageError);
                return;
            }
            res.setHeader('Content-Type', headerType);
            if (action === 'download') {
                var filename = path.basename(filePath);
                res.setHeader('Content-Disposition', 'attachment; filename=\"' + encodeURI(filename) + '\";"');
            }
            stream.pipe(res);
        });
    };

    app.get('/download', function (req, res) {
        getFile(req, res, 'download');
    });

    app.get('/show', function (req, res) {
        getFile(req, res, 'show');
    });
};
