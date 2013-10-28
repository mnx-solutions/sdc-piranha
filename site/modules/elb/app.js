'use strict';

var config = require('easy-config');
var restify = require('restify');
var fs = require('fs');
var httpSignature = require('http-signature');
var key = fs.readFileSync(config.elb.keyPath).toString();
var pem = require('pem');
var multiparty = require('multiparty');
module.exports = function execute(scope, app) {
    var client = restify.createJsonClient({
        url: config.elb.url,
        rejectUnauthorized: false,
        signRequest: function (req) {
            httpSignature.sign(req, {
                key: key,
                keyId: config.elb.keyId
            });
        }
    });

    function parsePemSection(pemSrc, sectionName) {
        var start = -1, end = -1, startMatch, endMatch;
        if ((startMatch = pemSrc.match(new RegExp('\\-+BEGIN ' + sectionName + '\\-+$', 'm')))) {
            start = startMatch.index;
        }
        if ((endMatch = pemSrc.match(new RegExp('^\\-+END ' + sectionName + '\\-+', 'm')))) {
            end = endMatch.index + (endMatch[0] || '').length;
        }
        if (start >= 0 && end >= 0) {
            return pemSrc.substring(start, end);
        }
        return null;
    }

    function getUploadResult(callback, resultObj) {
        return '<script language="javascript" type="text/javascript">' +
            callback + '(' + JSON.stringify(resultObj) + ');' +
            '</script>';
    }

    // This is needed as source for upload target iframe
    app.get('/blank', function (req, res) {
        res.send('');
    });

    app.post('/certificates', function (req, res) {
        var callback = req.query.callback;
        var form = new multiparty.Form();
        form.parse(req, function handleForm(err, fieldsObject, filesObject) {
            if (err || !filesObject.certificate) {
                res.send(getUploadResult(callback, {success: false, message: 'Certificate not found'}));
                return;
            }
            var data = {};
            var pemSrc = fs.readFileSync(filesObject.certificate.path, 'utf8');
            data['private'] = parsePemSection(pemSrc, 'RSA PRIVATE KEY');
            if (!data['private']) {
                res.send(getUploadResult(callback, {success: false, message: 'Private key not found in PEM'}));
                return;
            }
            pem.getPublicKey(pemSrc, function (err, publicKey) {
                if (err) {
                    res.send(getUploadResult(callback, {success: false, message: 'Public key not found in PEM: ' + err}));
                    return;
                }
                data['public'] = publicKey;
                client.post('/certificates', data, function (err, creq, cres, obj) {
                    if (err) {
                        res.send(getUploadResult(callback, {success: false, message: err}));
                        return;
                    }
                    obj.success = true;
                    res.send(getUploadResult(callback, obj));
                });
            });
        });
    });
};