'use strict';

var TFAProvider = require('./lib/TFAProvider');

module.exports = function execute(scope, app) {
    var smartCloud = scope.get('smartCloud');
    var TFA = scope.api('TFA');

    function logUserInformation(req, redirectUrl) {
        var info = {
            userName: req.session.userName,
            userId: req.session.userId,
            userAgent: req.headers['user-agent']
        };

        if (/\/signup\/$/.test(redirectUrl)) {
            req.log.info(info, 'New user logged in');
        } else {
            req.log.info(info, 'Existing user logged in');
        }
    }

    app.get('/saveToken/:url', function(req, res, next) {
        var token = req.query.token;
        // redirect to this url after we're done with the token
        var redirectUrl = (new Buffer(req.params.url, 'base64')).toString('ascii');

        var cloud = smartCloud.cloud({token: token});
        cloud.getAccount(function (err, data) {
            if (err) {
                next(err);
                return;
            }

            TFA.get(data.id, function (err, secret) {
                if (err) {
                    next(err);
                    return;
                }

                req.session.userId = data.id;
                req.session.userName = data.login;

                if (!secret) {
                    logUserInformation(req, redirectUrl);

                    // as sso passes token using ?token=
                    req.session.token = token;
                    req.session.save();

                    res.redirect(redirectUrl);
                } else {
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
        if (!req.session.token || !req.session.userId) {
            res.send(401);
            return;
        }

        TFA.set(req.session.userId, false, function(err, secretkey) {
            if (err) {
                res.json(500, {status: 'error', err: err});
                return;
            }

            res.json({ status: 'ok' });
        });
    });

    app.get('/setup', function (req, res, next) {
        if (!req.session.userId || !req.session.userName) {
            res.send(401);
            return;
        }

        req.session._tfaSecret = TFAProvider.generateSecret();
        req.session.save();

        var qrCode = TFAProvider.getQRcode(req.session._tfaSecret, req.session.userName);
        res.send(qrCode);
    });

    app.post('/setup', function (req, res, next) {
        if (!req.session._tfaSecret || !req.session.userId) {
            res.send(401);
            return;
        }

        var onetimepass = TFAProvider.generateOTP(req.session._tfaSecret);
        if (req.body.otpass === onetimepass) {
            TFA.set(req.session.userId, req.session._tfaSecret, function(err, secretkey) {
                if (err) {
                    req.log.error('Failed to enable TFA', err);
                    res.json({status:'error', message: 'Internal error'});
                    return;
                }

                // tfaEnabled will be enabled for their next login
                delete req.session._tfaSecret;
                req.session.save();
                res.json({status:'ok'});
            });
        } else {
            res.json({status:'error'});
        }
    });

    app.post('/login', function (req, res, next) {
        if (!req.session._tfaSecret || !req.session.userId) {
            res.send(401);
            return;
        }

        var onetimepass = TFAProvider.generateOTP(req.session._tfaSecret);
        if (req.body.otpass === onetimepass) {
            req.session.token = req.session._preToken;
            delete req.session._preToken;

            var redirect = req.session._tfaRedirect;
            delete req.session._tfaRedirect;
            req.session.save();

            logUserInformation(req, redirect);
            res.send({ status: 'ok', redirect: redirect });
        } else {
            res.send({ status: 'error'});
        }
    });
};