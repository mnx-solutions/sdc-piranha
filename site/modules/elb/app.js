'use strict';

var config = require('easy-config');
var restify = require('restify');
var fs = require('fs');
var httpSignature = require('http-signature');
var key = config.elb && config.elb.keyPath ? fs.readFileSync(config.elb.keyPath).toString() : null;
var ursa = require('ursa');
var express = require('express');

var elb = function execute(scope, app) {
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

    function getUploadResult(callback, resultObj) {
        return '<script language="javascript" type="text/javascript">' +
            callback + '(' + JSON.stringify(resultObj) + ');' +
            '</script>';
    }

    // This is needed as source for upload target iframe
    app.get('/blank', function (req, res) {
        res.send('');
    });

    app.post('/certificates', [express.multipart()], function (req, res) {
        req.log.info('Uploading certificate');
        var callback = req.query.callback;
        if (!req.files || !req.files.certificate) {
            req.log.info('Certificate not found in request');
            res.send(getUploadResult(callback, {success: false, message: 'Certificate not found'}));
            return;
        }
        fs.readFile(req.files.certificate.path, 'utf8', function (err, pemSrc) {
            if (err) {
                req.log.info('Certificate not found in request, cannot read file');
                res.send(getUploadResult(callback, {success: false, message: 'Certificate not found'}));
                return;
            }
            try {
                var privateKey = ursa.createPrivateKey(pemSrc, req.body.passphrase || '');
                var data = {
                    'private': privateKey.toPrivatePem(),
                    'public': privateKey.toPublicPem()
                };
                client.post('/certificates', data, function (err, creq, cres, obj) {
                    if (err) {
                        req.log.warn({err: err}, 'Error saving certificate into ELB API');
                        res.send(getUploadResult(callback, {success: false, message: 'Error saving certificate into ELB API'}));
                        return;
                    }
                    obj.success = true;
                    res.send(getUploadResult(callback, obj));
                });
            } catch (ex) {
                if (ex.message.indexOf('bad password') !== -1 || ex.message.indexOf('bad decrypt') !== -1) {
                    req.log.info('Certificate has passphrase, asking user for it');
                    res.send(getUploadResult(callback, {success: false, passphrase: true, message: 'Certificate has passphrase'}));
                    return;
                }
                req.log.info({ex: ex}, 'Private key not found in PEM');
                res.send(getUploadResult(callback, {success: false, message: 'Private key not found in PEM'}));
                return;
            }
        });
    });
};

if (!config.features || config.features.elb === 'enabled') {
    module.exports = elb;
}