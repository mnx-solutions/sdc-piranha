"use strict";

var path = require('path');
var config = require('easy-config');
var manta = require('manta');
var formidable = require('formidable');
var MemoryStream = require('memorystream');

module.exports = function (app) {
    var UPLOAD_ABORT_ERROR = 'write after end';
    var Manta = require('./').MantaClient;
    var filesInProgress = {};
    var waitCallbacks = {};
    var requestsInProgress = {};
    var uploadProgresses = Manta.uploadProgresses = {};
    var memoryStreams = {};

    var clearUpload = function (userId, fullPath, formId, keepProgress) {
        if (requestsInProgress[formId]) {
            delete requestsInProgress[formId][fullPath];
        }
        delete filesInProgress[userId][fullPath];
        if (!keepProgress) {
            memoryStreams[formId] && memoryStreams[formId].end();
            delete uploadProgresses[formId];
        }
    };

    app.post('/upload', function (req, res, next) {
        var formId;
        var form = new formidable.IncomingForm();
        var client = Manta.createClient({req: req});
        var filePath = false;
        var userId = req.session.userId;
        var memStream;
        var metadata;
        var done = function done(data) {
            if (!res.headersSent) {
                res.json(data);
            }
        };

        form.setMaxListeners(0);
        form.on('error', function (err) {
            req.log.warn({err: err}, 'Incoming form error');
            done({success: false, status: 200});
            clearUpload(userId, form.fullPath, formId, false);
        }).on('aborted', function (err) {
            req.log.warn({err: err}, 'Incoming form aborted');
            done({success: false, status: 200});
            clearUpload(userId, form.fullPath, formId, false);
        });
        form.on('end', function () {
            done({success: true, status: 200});
        });

        filesInProgress[userId] = filesInProgress[userId] || {};
        waitCallbacks[userId] = waitCallbacks[userId] || {};

        function checkFile(client, path, callback) {
            client.info(path, function (error) {
                if (error && error.statusCode === 404) {
                    setTimeout(checkFile.bind(null, client, path, callback), 1000);
                    return;
                }
                callback();
            });
        }

        function waitFile(client, path, callback) {
            var existingCallbacks = waitCallbacks[userId][path];
            if (existingCallbacks && existingCallbacks.length > 0) {
                existingCallbacks.push(callback);
                return;
            }
            waitCallbacks[userId][path] = existingCallbacks = [callback];
            checkFile(client, path, function () {
                existingCallbacks.forEach(function (cb) {
                    cb.call(this);
                });
                waitCallbacks[userId][path] = [];
            });
        }

        function uploadFile(path, part, callback) {
            var options = {
                size: metadata.files[part.filename],
                type: part.mime,
                headers: {
                    'max-content-length': metadata.files[part.filename]
                },
                mkdirs: true
            };

            memStream = memoryStreams[formId] = new MemoryStream();
            part.pipe(memStream);
            var outStream = client.createWriteStream('~~/' + path + '/' + part.filename, options);
            memStream.pipe(outStream);

            memStream.on('data', function (chunk) {
                uploadProgresses[formId] += chunk.length;
            });
            memStream.on('error', function (error) {
                callback(error);
            });
            memStream.on('end', function () {
                memStream = null;
                callback();
            });
        }

        function parseMetadata(part, callback) {
            var data = '';
            part.on('data', function (chunk) {
                data += chunk;
            });
            part.on('end', function () {
                callback(null, JSON.parse(data));
            });
            part.on('error', callback);
        }

        function checkForAllFinished() {
            if (uploadProgresses[formId] && Object.keys(requestsInProgress[formId] || {}).length === 0) {
                delete uploadProgresses[formId];
            } else {
                setTimeout(checkForAllFinished, 1000);
            }
        }

        function handleFinishedDownload(fullPath) {
            if (!filesInProgress[userId][fullPath]) {
                return;
            }
            // manta storage didn't updated so quickly, not depending on the file size
            waitFile(client, '~~/' + fullPath, function () {
                clearUpload(userId, fullPath, formId, true);
                checkForAllFinished();
            });
        }

        form.onPart = function (part) {
            if (part.name === 'metadata') {
                parseMetadata(part, function (error, obj) {
                    if (error) {
                        return next(error);
                    }
                    metadata = obj;
                    filePath = obj.path;
                    formId = obj.formId;
                });
            } else if (!part.filename) {
                form.handlePart(part);
            } else if (!filePath) {
                next(new Error('variable "path" should be placed in a start of multipart data'));
            } else {
                var fullPath = form.fullPath = filePath + '/' + part.filename;
                // sometimes onPort calls twice, with same data... mb bug in formidable module
                if (filesInProgress[userId][fullPath]) {
                    if (requestsInProgress[formId]) {
                        delete requestsInProgress[formId][fullPath];
                    }
                    return checkForAllFinished();
                }
                requestsInProgress[formId] = requestsInProgress[formId] || {};
                filesInProgress[userId][fullPath] = true;
                requestsInProgress[formId][fullPath] = true;
                uploadProgresses[formId] = 1;
                setTimeout(function () {
                    delete filesInProgress[userId][fullPath];
                }, 1000 * 60 * 30);
                uploadFile(filePath, part, function (error) {
                    if (error) {
                        clearUpload(userId, fullPath, formId, true);
                        // If upload was aborted by user
                        if (error.message === UPLOAD_ABORT_ERROR) {
                            return;
                        }
                        var logLevel = 'error';
                        var suppressError = false;
                        if (error.name === 'NoMatchingRoleTagError' || (error.name === 'AuthorizationFailedError' ||
                            error.name === 'ForbiddenError') && error.statusCode === 403 && req.session.subId) {
                            logLevel = 'info';
                            suppressError = true;
                        }
                        req.log[logLevel]({error: error}, 'Error while uploading files');
                        if (suppressError) {
                            res.json({status: 'error', message: error.message});
                            return;
                        }
                        if (!res.headersSent) {
                            res.status(error.statusCode || 500).send(error.message);
                        }
                        return;
                    }
                    handleFinishedDownload(fullPath);
                });
            }
        };
        form.parse(req);
    });

    app.get('/upload/abort', function (req, res) {
        var formId = req.query.formId;
        memoryStreams[formId] && memoryStreams[formId].end();
        res.status(200).end();
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
