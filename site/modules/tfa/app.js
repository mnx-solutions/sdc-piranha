'use strict';

var config = require('easy-config');
var TFAProvider = require('./lib/TFAProvider');
var metadata = require('../account/lib/metadata');
var SmartCloud = require('../../../lib/smartcloud');

module.exports = function execute(app, log, config) {
    var smartCloud = new SmartCloud({
        log: log,
        api: config.cloudapi
    });
    var TFA = require('./').TFA;

    var headerClientIpKey = config.server.headerClientIpKey;

    app.use(function (req, res, next) {
        if (req.session && req.session.userId && req.session.userName) {
            req.log = req.log.child({
                userName: req.session.userName,
                userId: req.session.userId
            });
        }
        next();
    });

    function logUserInformation(req) {
        // Proper user ip taking reverse proxy / load balancer into account
        if (headerClientIpKey) {
            req.userIp = req.header(headerClientIpKey);
        }

        req.userIp = req.userIp || req.ip;

        var info = {
            userName: req.session.parentAccount || req.session.userName,
            userId: req.session.parentAccountId || req.session.userId,
            userIp: req.userIp,
            userAgent: req.headers['user-agent'],
            campaignId: (req.cookies.campaignId || '')
        };

        if (req.session.subId) {
            info.subuserName = req.session.userName;
            info.subuserId = req.session.userId;
            req.log.info(info, 'Sub user logged in');
        } else if (req.session.userIsNew) {
            req.log.info(info, 'New user logged in');
        } else {
            req.log.info(info, 'Existing user logged in');
        }
    }

    function isOneTimePasswordCorrect(req, res) {
        var result = req.body.otpass === TFAProvider.generateOTP(req.session._tfaSecret);
        if (!result) {
            req.log.info('User provided password not the same as generated TFA password');
            res.json({status: 'error'});
        }
        return result;
    }

    app.get('/saveToken/:url', function(req, res, next) {
        var token = req.query.token;
        var userId = req.query.id;
        req.params.url = req.params.url.replace(/\-/g, '/');
        // redirect to this url after we're done with the token
        var redirectUrl = (new Buffer(req.params.url, 'base64')).toString('ascii');
        smartCloud.cloud({token: token, log: req.log, session: req.session}, function (error, cloud) {
            var saveSessionToken = function (userObj, signupStep, tfaSecret) {
                req.session.userId = userObj.id;
                req.session.userName = userObj.login;
                req.session.redirectUrl = redirectUrl;
                req.session.userIsNew = !signupStep && userObj.created === userObj.updated;
                if (tfaSecret) {
                    req.session._preToken = token;
                    req.session._tfaSecret = tfaSecret;
                } else {
                    req.session.token = token;
                }
                req.session.save();
                if (tfaSecret) {
                    req.log.info({userId: userObj.id}, 'User redirected to TFA login');
                    res.redirect('/#!/tfa');
                } else {
                    logUserInformation(req);
                    res.redirect(redirectUrl);
                }
            };

            var userCallback = function (err, user) {
                if (err) {
                    next(err);
                    return;
                }
                if (userId) {
                    req.session.subId = userId;
                    cloud.getAccount(function (err, account) {
                        req.session.parentAccountError = err;
                        if (!err) {
                            req.session.parentAccount = account.login;
                            req.session.parentAccountId = account.id;
                        }
                        saveSessionToken(user);
                    });
                }
            };

            var accountCallback = function (err, user) {
                if (err) {
                    next(err);
                    return;
                }
                TFA.getSecurity(user.id, function (tfaErr, secret) {
                    if (tfaErr) {
                        next(tfaErr);
                        return;
                    }

                    if (!req.session) {
                        req.log.fatal('Session is not valid, probably Redis is not running');
                        process.exit();
                    }

                    // clear session string properties (like signupStep)
                    for (var prop in req.session) {
                        if (req.session.hasOwnProperty(prop) && typeof (req.session[prop]) === 'string') {
                            delete req.session[prop];
                        }
                    }

                    metadata.get(user.id, metadata.SIGNUP_STEP, function (metaErr, signupStep) {
                        // can safely ignore possible metadata error here
                        saveSessionToken(user, signupStep, secret);
                    });
                });
            };
            if (userId) {
                if (config.features.rbac === 'disabled') {
                    var error = new Error('Role-based access control is not yet available');
                    error.statusCode = 403;
                    next(error);
                    return;
                }
                cloud.getUser(userId, userCallback);
            } else {
                cloud.getAccount(accountCallback);
            }
        });
    });

    app.get('/remove', function (req, res, next) {
        req.log.debug('Attempting to remove TFA');
        if (!req.session.token || !req.session.userId) {
            req.log.warn('User not authorized');
            res.sendStatus(401);
            return;
        }

        TFA.setSecurity(req.session.userId, false, function(err, secretkey) {
            if (err) {
                req.log.error(err, 'TFA removal failed');
                res.sendStatus(500).json({status: 'error', err: err});
                return;
            }

            req.log.info('TFA removed from user');
            res.json({status: 'ok'});
        });
    });

    app.get('/setup', function (req, res, next) {
        req.log.debug('Attempting to start TFA setup');
        if (!req.session.userId || !req.session.userName) {
            req.log.warn('User not authorized');
            res.sendStatus(401);
            return;
        }

        req.session._tfaSecret = TFAProvider.generateSecret();
        req.session.save();

        req.log.info('Sent QR code for TFA setup');
        var qrCode = TFAProvider.getQRcode(req.session._tfaSecret, req.session.userName);
        res.send(qrCode);
    });

    app.post('/setup', function (req, res, next) {
        req.log.debug('Attempting to complete TFA setup');
        if (!req.session._tfaSecret || !req.session.userId) {
            req.log.warn('User not authorized');
            res.sendStatus(401);
            return;
        }

        if (isOneTimePasswordCorrect(req, res)) {
            TFA.setSecurity(req.session.userId, req.session._tfaSecret, function(err, secretkey) {
                if (err) {
                    req.log.error(err, 'Failed to enable TFA');
                    res.json({status:'error', message: 'Internal error'});
                    return;
                }

                req.log.info('TFA enabled for user');
                // tfaEnabled will be enabled for their next login
                delete req.session._tfaSecret;
                req.session.save();
                res.json({status:'ok'});
            });
        }
    });

    app.post('/login', function (req, res, next) {
        req.log.debug('User attempting to log in via TFA');
        if (!req.session._tfaSecret || !req.session.userId) {
            req.log.warn('User session information missing');
            res.sendStatus(401);
            return;
        }

        if (isOneTimePasswordCorrect(req, res)) {
            req.session.token = req.session._preToken;
            delete req.session._preToken;

            var redirect = req.session.redirectUrl;
            delete req.session.redirectUrl;
            req.session.save();

            logUserInformation(req, redirect);
            res.send({status: 'ok', redirect: redirect});
        }
    });
};
