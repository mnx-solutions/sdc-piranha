'use strict';

var TFAProvider = require('./lib/TFAProvider');

module.exports = function execute(scope, app) {
    var smartCloud = scope.get('smartCloud');
    var TFA = scope.api('TFA');

    var headerClientIpKey = scope.config.server.headerClientIpKey;

    app.use(function (req, res, next) {
        if (req.session && req.session.userId && req.session.userName) {
            req.log = req.log.child({
                userName: req.session.userName,
                userId: req.session.userId
            });
        }
        next();
    });

    function logUserInformation(req, redirectUrl) {
        // Proper user ip taking reverse proxy / load balancer into account
        if (headerClientIpKey) {
            req.userIp = req.header(headerClientIpKey);
        }

        req.userIp = req.userIp || req.ip;

        var info = {
            userAgent: req.headers['user-agent'],
            campaignId: (req.cookies.campaignId || '')
        };

        if (/\/signup\/$/.test(redirectUrl)) {
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
        // redirect to this url after we're done with the token
        var redirectUrl = (new Buffer(req.params.url, 'base64')).toString('ascii');

        var cloud = smartCloud.cloud({token: token, log: req.log});
        cloud.getAccount(function (err, user) {
            if (err) {
                next(err);
                return;
            }

            TFA.get(user.id, function (err, secret) {
                if (err) {
                    next(err);
                    return;
                }

                if (!req.session) {
                    req.log.fatal('Session is not valid, probably Redis is not running');
                    process.exit();
                }

                req.session.userId = user.id;
                req.session.userName = user.login;

                if (!secret) {
                    logUserInformation(req, redirectUrl);

                    // as sso passes token using ?token=
                    req.session.token = token;
                    req.session.save();

                    res.redirect(redirectUrl);
                } else {
                    req.log.info({userId: user.id}, 'User redirected to TFA login');
                    req.session._preToken = token;
                    req.session._tfaSecret = secret;
                    req.session._tfaRedirect = redirectUrl;
                    req.session.save();

                    res.redirect('/#!/tfa');
                }
            });
        });
    });

    app.get('/remove', function (req, res, next) {
        req.log.debug('Attempting to remove TFA');
        if (!req.session.token || !req.session.userId) {
            req.log.warn('User not authorized');
            res.send(401);
            return;
        }

        TFA.set(req.session.userId, false, function(err, secretkey) {
            if (err) {
                req.log.error(err, 'TFA removal failed');
                res.json(500, {status: 'error', err: err});
                return;
            }

            req.log.info('TFA removed from user');
            res.json({ status: 'ok' });
        });
    });

    app.get('/setup', function (req, res, next) {
        req.log.debug('Attempting to start TFA setup');
        if (!req.session.userId || !req.session.userName) {
            req.log.warn('User not authorized');
            res.send(401);
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
            res.send(401);
            return;
        }

        if (isOneTimePasswordCorrect(req, res)) {
            TFA.set(req.session.userId, req.session._tfaSecret, function(err, secretkey) {
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
            res.send(401);
            return;
        }

        if (isOneTimePasswordCorrect(req, res)) {
            req.session.token = req.session._preToken;
            delete req.session._preToken;

            var redirect = req.session._tfaRedirect;
            delete req.session._tfaRedirect;
            req.session.save();

            logUserInformation(req, redirect);
            res.send({ status: 'ok', redirect: redirect });
        }
    });
};