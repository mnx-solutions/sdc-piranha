
'use strict';

var fs = require('fs');
var countryCodes = require('./data/country-codes');
var exec = require('child_process').exec;
var os = require('os');
var uuid = require('../../static/vendor/uuid/uuid.js');
var ursa = require('ursa');
var jobs = {};
var multer = require('multer');
var zuora = require('zuora-rest');
/**
 * @ngdoc service
 * @name account.service:api
 * @requires $rootScope $q serverTab $$track
 *
 * @description
 * Account module API
 */
module.exports = function execute(app, log, config) {
    var SignupProgress = require('../account').SignupProgress;
    var countriesValidation = config.zuora && config.zuora.rest && config.zuora.rest.validation && config.zuora.rest.validation.countries;

    app.get('/countryCodes', function (req, res) {
        var data = countryCodes.getArray(countriesValidation);
        data.forEach(function (el) {
            if (['USA', 'CAN', 'GBR'].indexOf(el.iso3) >= 0) {
                el.group = 'Default';
            } else {
                el.group = 'All countries';
            }
        });
        res.json(data);
    });

    app.get('/countries', function (req, res) {
        var data = zuora.countries.getArray(countriesValidation);
        data.forEach(function (el) {
            if (['USA','CAN','GBR'].indexOf(el.iso3) >= 0) {
                el.group = 'Default';
            } else {
                el.group = 'All countries';
            }
        });
        res.json(data);
    });

    app.get('/states', function (req, res) {
        res.json(zuora.states);
    });

    if (config.features.allowSkipBilling === 'enabled') {
        app.get('/signup/skipBilling', function (req, res) {
            SignupProgress.setMinProgress(req, 'billing', function () {
                log.info('User skipped Billing and SSH step');
                SignupProgress.setMinProgress(req, 'ssh', function () {
                    res.json({success: true});
                });
            });
        });
    }
    // TODO: let's combine skipSsh and passSsh routes in one
    app.get('/signup/skipSsh', function (req, res) {
        SignupProgress.setMinProgress(req, 'ssh', function () {
            log.info('User skipped SSH step');
            SignupProgress.sendSshResponse(req, res);
        });
    });

    app.get('/signup/passSsh', function (req, res) {
        SignupProgress.setMinProgress(req, 'ssh', function () {
            log.info('User passed SSH step');
            SignupProgress.sendSshResponse(req, res);
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
        var subUser = req.body.subUser;

        req.log.debug('Adding SSH key to the account');
        var perform;
        if (subUser) {
            perform = SignupProgress.addSubUserSshKey;
        } else {
            perform = SignupProgress.addSshKey;
        }
        perform(req, name, publicKey, function (err) {
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

    function prepareSshKeyToDownload(req, res, isPublic) {
        var keyId = req.params.keyId;
        var key = req.session.privateKeys && req.session.privateKeys[keyId];

        if (!key) {
            req.log.error('Invalid SSH key requested');
            return null;
        }

        var fileName = key.name + '_id_rsa' + (isPublic ? '.pub' : '');

        res.set('Content-type', 'application/x-pem-file');
        res.set('Content-Disposition', 'attachment; filename="' + fileName + '"');
        return key;
    }

    app.get('/ssh/download/:keyId', function (req, res, next) {
        var key = prepareSshKeyToDownload(req, res, false);
        if (key) {
            res.send(key.privateKey);
        }
    });

    app.get('/ssh/downloadPublic/:keyId', function (req, res, next) {
        var key = prepareSshKeyToDownload(req, res, true);
        if (key) {
            res.send(key.publicKey);
        }
    });

    app.post('/upload', [multer()], function (req, res, next) {
        var files = req.files && req.files.uploadInput;
        var subUser = req.query.userId;
        var perform;

        if (subUser) {
            perform = SignupProgress.addSubUserSshKey;
        } else {
            perform = SignupProgress.addSshKey;
        }

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
                    var fingerprintHex = publicKey.toPublicSshFingerprint('hex');
                    var name = fingerprintHex.slice(-10);
                    perform(req, name, data, function (err) {
                        if (err) {
                            if (err.statusCode !== 409) {
                                req.log.error(err);
                            }
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
                    error: 'The file you\'ve uploaded is not a public key.',
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
        res.sendStatus(200).send('OK');
    });
};
