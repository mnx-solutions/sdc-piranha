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
                client.put(filePath, rs, {size: file.size}, function (error) {
                    if (error) {
                        error.message = 'Error occurred while uploading file "' + file.originalFilename + '": ' + error.message;
                    }
                    callback(error, null);
                });
            }
        }, function (error) {
            if (error) {
                req.log.error({error: error}, 'Error while uploading files');
                var firstError = Array.isArray(error.ase_errors) && error.ase_errors[0];
                res.send(firstError.statusCode || 500, firstError.message);
                return;
            }
            res.json({success: true, status: 200});
        });
    });

    app.get('/download', function (req, res, next) {
        var client = Manta.createClient({req: req});
        client.get(req.query.path, function (err, stream) {
            if (err) {
                req.log.error({error: err}, 'Error while downloading file');
                return;
            }
            var filename = path.basename(req.query.path);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', 'attachment; filename=\"' + filename + '\";"');
            stream.pipe(res);
        });
    });
};
