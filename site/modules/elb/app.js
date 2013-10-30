'use strict';

var config = require('easy-config');
var restify = require('restify');
var fs = require('fs');
var httpSignature = require('http-signature');
var key = config.elb && config.elb.keyPath ? fs.readFileSync(config.elb.keyPath).toString() : null;
var pem = require('pem');
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
        var data = {};
        fs.readFile(req.files.certificate.path, 'utf8', function (err, pemSrc) {
            if (err) {
                req.log.info('Certificate not found in request, cannot read file');
                res.send(getUploadResult(callback, {success: false, message: 'Certificate not found'}));
                return;
            }
            pem.getPrivateKey(pemSrc, req.body.passphrase, function (err, privateKey) {
                if (err) {
                    if (err && (err.message.indexOf('bad password') !== -1 || err.message.indexOf('bad decrypt') !== -1)) {
                        req.log.info('Certificate has passphrase, asking user for it');
                        res.send(getUploadResult(callback, {success: false, passphrase: true, message: 'Certificate has passphrase'}));
                        return;
                    }
                    req.log.info({err: err}, 'Private key not found in PEM');
                    res.send(getUploadResult(callback, {success: false, message: 'Private key not found in PEM'}));
                    return;
                }
                //Not using dot notation here cause private/public are reserved in future JS versions
                data['private'] = privateKey;
                pem.getPublicKey(pemSrc, req.body.passphrase, function (err, publicKey) {
                    if (err) {
                        if (err && (err.message.indexOf('bad password') !== -1 || err.message.indexOf('bad decrypt') !== -1)) {
                            req.log.info('Certificate has passphrase, asking user for it');
                            res.send(getUploadResult(callback, {success: false, passphrase: true, message: 'Certificate has passphrase'}));
                            return;
                        }
                        req.log.info({err: err}, 'Public key not found in PEM');
                        res.send(getUploadResult(callback, {success: false, message: 'Public key not found in PEM'}));
                        return;
                    }
                    data['public'] = publicKey;
                    client.post('/certificates', data, function (err, creq, cres, obj) {
                        if (err) {
                            req.log.warn({err: err}, 'Error saving certificate into ELB API');
                            res.send(getUploadResult(callback, {success: false, message: 'Error saving certificate into ELB API'}));
                            return;
                        }
                        obj.success = true;
                        res.send(getUploadResult(callback, obj));
                    });
                });
            });
        });
    });
};

if (!config.features || config.features.elb === 'enabled') {
    module.exports = elb;
}