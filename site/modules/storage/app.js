"use strict";

var fs = require('fs');
var path = require('path');
var config = require('easy-config');
var manta = require('manta');
var express = require('express');
var vasync = require('vasync');
var formidable = require('formidable');

module.exports = function (scope, app) {
    var Manta = scope.api('MantaClient');

    var filesInProgress = {};
    var waitCallbacks = {};
    var requestsInProgress = {};

    app.post('/upload', function (req, res, next) {
        var form = new formidable.IncomingForm();
        form.on('error', function (err) {
            req.log.warn({err: err}, 'Incoming form error');
            this.ended = true;
        }).on('aborted', function (err) {
            req.log.warn({err: err}, 'Incoming form aborted');
            this.ended = true;
        });
        var formId = Math.random();
        var client = Manta.createClient({req: req});
        var filePath = false;
        var userId = req.session.userId;
        filesInProgress[userId] = filesInProgress[userId] || {};
        waitCallbacks[userId] = waitCallbacks[userId] || {};
        requestsInProgress[formId] = {};

        var metadata;

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

        function getFormidableStream(form, part) {
            var libStream = require('stream');
            var formidableStream = new libStream.Readable();
            formidableStream.wrap({
                on: function (event, callback) {
                    if (event === 'data' || event === 'end') {
                        part.addListener.call(part, event, callback);
                    } else {
                        form.addListener.call(form, event, callback);
                    }
                },
                pause: form.pause.bind(form),
                resume: form.resume.bind(form)
            });

            return formidableStream;
        };

        function uploadFile(path, part, callback) {
            var options = {
                size: metadata.files[part.filename],
                type: part.mime,
                headers: {
                    'max-content-length': metadata.files[part.filename]
                },
                mkdirs: true
            };
            client.put('~~/' + path + '/' + part.filename, getFormidableStream(form, part), options, function (error) {
                callback(error);
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
            if (Object.keys(requestsInProgress[formId]).length === 0) {
                if (!res.headersSent) {
                    res.json({success: true, status: 200});
                }
            } else {
                setTimeout(checkForAllFinished, 1000);
            }
        }

        function handleFinishedDownload(fullPath) {
            // manta storage didn't updated so quickly, not depending on the file size
            waitFile(client, '~~/' + fullPath, function () {
                delete filesInProgress[userId][fullPath];
                delete requestsInProgress[formId][fullPath];
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
                });
            } else if (!part.filename) {
                form.handlePart(part);
            } else if (!filePath) {
                next(new Error('variable "path" should be placed in a start of multipart data'));
            } else {
                var fullPath = filePath + '/' + part.filename;
                if (filesInProgress[userId][fullPath]) {
                    // sometimes onPort calls twice, with same data... mb bug in formidable module
                    delete requestsInProgress[formId][fullPath];
                    checkForAllFinished();
                    return;
                }
                filesInProgress[userId][fullPath] = true;
                requestsInProgress[formId][fullPath] = true;
                setTimeout(function () {
                    delete filesInProgress[userId][fullPath];
                }, 1000 * 60 * 10);
                uploadFile(filePath, part, function (error) {
                    if (error) {
                        req.log.error({error: error}, 'Error while uploading files');
                        delete filesInProgress[userId][fullPath];
                        delete requestsInProgress[formId][fullPath];
                        if (error.name === 'NoMatchingRoleTagError') {
                            res.json({status: 'error', message: error.message});
                            return;
                        }
                        res.send(error.statusCode || 500, error.message);
                        return;
                    }
                    handleFinishedDownload(fullPath);
                });
            }
        };
        form.parse(req);
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
                res.setHeader('Content-Disposition', 'attachment; filename=\"' + filename + '\";"');
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
