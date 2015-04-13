'use strict';

var config = require('easy-config');
var fs = require('fs');
var key = config.slb && config.slb.keyPath ? fs.readFileSync(config.slb.keyPath).toString() : null;
var ursa = require('ursa');
var express = require('express');
var multer = require('multer');

var slb = function execute(app) {

    var ssc = require('./').SLB;
    var getSscClient = ssc.getSscClient;

    function getUploadResult(callback, resultObj) {
        return '<script language="javascript" type="text/javascript">' +
            callback + '(' + JSON.stringify(resultObj) + ');' +
            '</script>';
    }

    function sendResponse(req, res, obj) {
        if (res.headersSent) {
            req.log.error('Cannot serve certificate upload status. Headers already sent');
            return;
        }
        res.send(getUploadResult(req.query.callback, obj));
    }

    // This is needed as source for upload target iframe
    app.get('/blank', function (req, res) {
        res.send('');
    });

    app.post('/certificates', [multer()], function (req, res) {
        req.log.info('Uploading certificate');
        var callback = req.query.callback;
        if (!req.files || !req.files.certificate) {
            req.log.info('Certificate not found in request');
            sendResponse(req, res, {success: false, message: 'Certificate not found'});
            return;
        }
        fs.readFile(req.files.certificate.path, 'utf8', function (err, pemSrc) {
            if (err) {
                req.log.info('Certificate not found in request, cannot read file');
                sendResponse(req, res, {success: false, message: 'Certificate not found'});
                return;
            }
            try {
                var privateKey = ursa.createPrivateKey(pemSrc, req.body.passphrase || '');
                var data = {
                    'private': privateKey.toPrivatePem('utf8'),
                    'public': privateKey.toPublicPem('utf8')
                };

                getSscClient({req: req, log: req.log}, function (err, client) {
                    client.post('/certificates', data, function (err, creq, cres, obj) {
                        if (err) {
                            req.log.warn({err: err}, 'Error saving certificate into SLB API');
                            sendResponse(req, res, {success: false, message: 'Error saving certificate into SLB API'});
                            return;
                        }
                        obj.success = true;
                        sendResponse(req, res, obj);
                    });
                });
            } catch (ex) {
                if (ex.message.indexOf('bad password') !== -1 || ex.message.indexOf('bad decrypt') !== -1) {
                    req.log.info('Certificate has passphrase, asking user for it');
                    sendResponse(req, res, {success: false, passphrase: true, message: 'Certificate has passphrase'});
                    return;
                }
                req.log.info({ex: ex}, 'Private key not found in PEM');
                sendResponse(req, res, {success: false, message: 'Private key not found in PEM'});
            }
        });
    });
};

if (!config.features || config.features.slb === 'enabled') {
    module.exports = slb;
}
