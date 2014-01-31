"use strict";

var fs = require('fs');
var path = require('path');
var config = require('easy-config');
var manta = require('manta');
var multiparty = require('multiparty');

module.exports = function (scope, app) {
    var Manta = scope.api('MantaClient');

    app.post('/upload', function (req, res, next) {
        var form = new multiparty.Form();
        form.parse(req, function handleForm(err, fields, files) {

            if (!(files && files.uploadInput)) {
                return res.json({success: false});
            }

            var rs = fs.createReadStream(files.uploadInput.path);
            var client = Manta.createClient({req: req});

            var filePath = '/' + (config.manta.user || req.session.username) + fields.path + '/' + files.uploadInput.originalFilename;

            client.put(filePath, rs, function (error) {
                if (error) {
                    req.log.error(error);
                }
                res.json({success: true});
            });
        });
    });

    app.get('/download', function (req, res, next) {
        var client = Manta.createClient({req: req});
        client.get(req.query.path, function (err, stream) {
            if (err) {
                req.log.error(err);
                return;
            }
            var filename = path.basename(req.query.path);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('Content-Disposition', 'attachment; filename=\"' + filename + '\";"');
            stream.pipe(res);
        });
    });
};
