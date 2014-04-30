
'use strict';

var crypto = require('crypto');
var config = require('easy-config');
var fs = require('fs');
var countryCodes = require('./data/country-codes');
var exec = require('child_process').exec;
var os = require('os');
var uuid = require('../../static/vendor/uuid/uuid.js');
var ursa = require('ursa');
var jobs = {};
var express = require('express');

/**
 * @ngdoc service
 * @name account.service:api
 * @requires $rootScope $q serverTab $$track
 *
 * @description
 * Account module API
 */
module.exports = function execute(scope, app) {

    var SignupProgress = scope.api('SignupProgress');

    app.get('/countryCodes', function (req, res) {
        var data = countryCodes.getArray(config.zuora.rest.validation.countries);
        data.forEach(function (el) {
            if (['USA', 'CAN', 'GBR'].indexOf(el.iso3) >= 0) {
                el.group = 'Default';
            } else {
                el.group = 'All countries';
            }
        });
        res.json(data);
    });

    app.get('/setStep/:step', function (req, res) {
        // This allows to skip signup, so only allowing it in test mode
        req.session.allowSignup = true;
        req.session.save();
        res.redirect('/signup/#!/' + req.params.step);
    });

    if (config.features.allowSkipBilling === 'enabled') {
        app.get('/signup/skipBilling', function (req, res) {
            SignupProgress.setMinProgress(req, 'billing', function () {
                scope.log.info('User skipped Billing and SSH step');
                SignupProgress.setMinProgress(req, 'ssh', function () {
                    res.json({success: true});
                });
            });
        });
    }
    app.get('/signup/skipSsh', function (req, res) {
        SignupProgress.setMinProgress(req, 'ssh', function () {
            scope.log.info('User skipped SSH step');
            res.json({success: true});
        });
    });

    app.get('/signup/passSsh', function (req, res) {
        SignupProgress.setMinProgress(req, 'ssh', function () {
            scope.log.info('User passed SSH step');
            res.json({success: true});
        });
    });

    app.get('/changepassword/:uuid', function (req, res, next) {
        var url = config.sso.url + '/changepassword/' + req.params.uuid;
        if (config.features.useBrandingOrange === 'enabled') {
            url += '?branding=orange';
        }
        res.redirect(url);
    });

    /* SSH keys logic */
    app.post('/ssh/create/:name?', function (req, res, next) {
        req.log.debug('Generating SSH key pair');
        var key = ursa.generatePrivateKey();
        var privateKey = key.toPrivatePem('utf8');
        var publicKey = 'ssh-rsa ' + key.toPublicSsh('base64');
        var fingerprintHex = key.toPublicSshFingerprint('hex');
        var fingerprint = fingerprintHex.replace(/([a-f0-9]{2})/gi, '$1:').slice(0, -1);
        var name = req.body.name || fingerprintHex.slice(-10);

        req.log.debug('Adding SSH key to the account');
        SignupProgress.addSshKey(req, name, publicKey, function (err) {
            if (err) {
                req.log.error(err);
                res.json({success: false, err: err});
                return;
            }
            req.session.privateKeys = req.session.privateKeys || {};
            req.session.privateKeys[fingerprint] = {
                privateKey: privateKey,
                publicKey: publicKey,
                name: name,
                fingerprint: fingerprint
            };
            req.session.save();
            res.json({success: true, keyId: fingerprint, name: name});
        });
    });

    app.get('/ssh/download/:keyId', function (req, res, next) {
        var keyId = req.params.keyId;
        var key = req.session.privateKeys && req.session.privateKeys[keyId];

        if (!key) {
            req.log.error('Invalid SSH key requested');
            return;
        }

        var fileName = key.name + '_id_rsa';

        res.set('Content-type', 'application/x-pem-file');
        res.set('Content-Disposition', 'attachment; filename="' + fileName + '"');
        res.send(key.privateKey);
    });

    app.post('/upload', [express.multipart()], function (req, res, next) {
        var files = req.files && req.files.uploadInput;

        if (files && !Array.isArray(files)) {
            files = [files];
        }

        var keyPath = files[0].path;
        fs.readFile(keyPath, 'utf8', function (err, data) {
            if (err) {
                req.log.error(err);
                res.json({success: false, err: err});
                return;
            }

            try {
                var publicKey = ursa.openSshPublicKey(data);
                if (publicKey) {
                    var name = '';
                    var keyParts = data.split(' ');

                    if (keyParts[2]) {
                        name = keyParts[2];
                    }

                    SignupProgress.addSshKey(req, name, data, function (err) {
                        if (err) {
                            req.log.error(err);
                            res.json({
                                error: err.message,
                                status: err.statusCode
                            });
                            return;
                        }
                        res.json({success: true});
                    });
                }
            } catch (error) {
                res.json({
                    error: "The file you've uploaded is not a public key.",
                    status: 422
                });
            }
        });
    });

    app.post('/log/error', function (req, res) {
        // note that client-side is not able to log "FATAL" level errors
        var supportedLevels = [
            'error',
            'warn',
            'debug',
            'info',
            'trace'
        ];

        var logLevel = req.body.level;
        if (!logLevel || supportedLevels.indexOf(logLevel.toLowerCase()) === -1) {
            logLevel = 'debug';
        }

        req.log[logLevel]({userInfo: req.body.userInfo, args: req.body.args}, req.body.message);
        res.send(200);
    });
};