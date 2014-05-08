"use strict";

var fs = require('fs');
var path = require('path');
var config = require('easy-config');
var manta = require('manta');
var express = require('express');
var vasync = require('vasync');

module.exports = function (scope, app) {
    var Manta = scope.api('MantaClient');

    app.post('/upload', [express.multipart()], function (req, res, next) {
        var files = req.files && req.files.uploadInput;

        if (files && !Array.isArray(files)) {
            files = [files];
        }

        var client = Manta.createClient({req: req});
        vasync.forEachParallel({
            inputs: files,
            func: function (file, callback) {
                var rs = fs.createReadStream(file.path);
                var filePath = '/' + client.user + req.body.path + '/' + file.originalFilename;
                filePath = filePath.replace(/\/+/g, '/');

                req.log.info({filePath: filePath}, 'Uploading file');
                client.put(filePath, rs, {size: file.size}, callback);
            }
        }, function (error) {
            if (error) {
                req.log.error({error: error}, 'Error while uploading files');
            }
            res.json({success: true, status: 200});
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
