"use strict";

var fs = require('fs');
var path = require('path');
var config = require('easy-config');
var manta = require('manta');
var multiparty = require('multiparty');

module.exports = function (scope, app) {

    function createClient(call, callback) {
        var client = manta.createClient({
            sign: manta.privateKeySigner({
                key: fs.readFileSync(config.manta.privateKey, 'utf8'),
                keyId: config.manta.keyId,
                user: config.manta.user || call.req.session.username
            }),
            user: config.manta.user || call.req.session.username,
            url: config.manta.url
        });

        callback(client);
    }


    app.post('/upload', function(req, res, next) {
        var form = new multiparty.Form();
        form.parse(req, function handleForm(err, fields, files) {

            if (!(files && files.uploadInput)) {
                return res.json({success: false});
            }

            var rs = fs.createReadStream(files.uploadInput.path);
            createClient({req:req}, function(client) {
                var filePath = '/' + (config.manta.user || req.session.username) + fields.path + '/' + files.uploadInput.originalFilename;
                
                client.put(filePath, rs, function(error) {
                    if (error) {
                        req.log.error(error);
                    }
                    res.json({success: true});
                });
            });
        });
    });
    
    app.get('/download', function(req, res, next) {
        createClient({req:req}, function(client) {
            client.get(req.query.path, function(err, stream) {
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
    });
};
