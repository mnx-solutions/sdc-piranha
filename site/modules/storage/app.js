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

    app.post('/upload', function (req, res, next) {
        var form = new formidable.IncomingForm();
        var client = Manta.createClient({req: req});
        var filePath = false;
        var filesInProgress = {};
        var metadata;

        function waitFile(client, path, callback) {
            client.info(path, function (error) {
                if (error && error.statusCode === 404) {
                    setTimeout(waitFile.bind(null, client, path, callback), 1000);
                    return;
                }
                callback();
            });
        }

        function uploadFile(path, part, callback) {
            var options = {type: part.mime, headers: {'max-content-length': metadata.files[part.filename]}};
            var ws = client.createWriteStream('~~/' + path + '/' + part.filename, options);
            ws.on('end', callback);
            ws.on('error', function (error) {
                error.message = 'Error occurred while uploading file "' + part.filename + '": ' + error.message;
                callback(error);
            });
            part.pipe(ws);
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
            } else if (!filesInProgress[filePath]) { // sometimes onPort calls twice, with same data... mb bug in formidable module
                filesInProgress[filePath] = true;
                uploadFile(filePath, part, function (error) {
                    if (error) {
                        req.log.error({error: error}, 'Error while uploading files');
                        res.send(error.statusCode || 500, error.message);
                        return;
                    }

                    // manta storage didn't updated so quickly, not depending on the file size
                    waitFile(client, '~~/' + filePath + '/' + part.filename, function () {
                        res.json({success: true, status: 200});
                    });
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
        client.get(req.query.path, function (err, stream) {
            if (err) {
                req.log.error({error: err}, messageError);
                return;
            }
            res.setHeader('Content-Type', headerType);
            if (action === 'download') {
                var filename = path.basename(req.query.path);
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
