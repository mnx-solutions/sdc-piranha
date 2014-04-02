'use strict';

var crypto = require('crypto');
var fs = require('fs');

module.exports = function execute(scope, app, callback) {
    var config = scope.config.sso;
    var privateKey = null;

    if (!config) {
        scope.log.fatal('SSO config missing');
        process.exit();
    }

    function sendToSSO(req, res, method, redirectUrl, redirect, campaignId) {
        // returnUrl will save the token and then redirect
        // req.protocol returned wrong protocol in some browsers
        var protocol = 'https';

        if (app.settings.env === 'development' || app.settings.env === 'staging') {
            protocol = req.protocol;
        }

        var baseUrl = new Buffer(protocol + '://' + req.headers.host + (req.body.method === 'signup' ? '/signup/' : redirectUrl)).toString('base64');
        var returnUrl = protocol + '://' + req.headers.host + '/tfa/saveToken/' + baseUrl + '/';
        var ssoUrl = config.url + '/' + method;

        var date = new Date().toUTCString();
        var nonce = Math.random().toString(36).substring(7);

        var brandingEnabled = scope.config.features.useBrandingOrange === 'enabled';
        var phoneVerificationDisabled = scope.config.features.phoneVerification !== 'enabled';

        // build the query string
        campaignId = campaignId || req.cookies.campaignId;
        var querystring = (brandingEnabled ? 'branding=orange&' : '') +
            (campaignId ? 'cid=' + campaignId + '&' : '') +
            (brandingEnabled && phoneVerificationDisabled ? 'hideVerify=true&' : '') +
            'keyid=' + encodeURIComponent(config.keyId) + '&' +
            'nonce=' + encodeURIComponent(nonce) + '&' +
            'now=' + encodeURIComponent(date) + '&' +
            'permissions=' + encodeURIComponent(JSON.stringify({'cloudapi': ['/my/*']})) + '&' +
            'returnto=' + encodeURIComponent(returnUrl);

        var signer = crypto.createSign('sha256');
        signer.update(encodeURIComponent(ssoUrl +'?' + querystring));
        var signature = signer.sign(privateKey, 'base64');
        querystring += '&sig=' + encodeURIComponent(signature);

        var url = ssoUrl + '?' + querystring;
        if (redirect) {
            res.redirect(url);
            return;
        }

        res.json({url: url});
    }

    app.post('/ssourl', function (req, res, next) {
        sendToSSO(req, res, req.body.method, req.body.redirectUrl);
    });

    app.get('/signup/:campaignId?', function (req, res, next) {
        if(req.params.campaignId) {
            // set campaign id to the cookie
            req.log.debug({campaignId: req.params.campaignId}, 'campaignId cookie set for user');
            res.cookie('campaignId', req.params.campaignId, { maxAge: 900000, httpOnly: false});
            // faking signup button
            req.body.method = 'signup';
        }
        req.log.info({campaignId: req.params.campaignId}, 'User landed on signup url');
        sendToSSO(req, res, 'signup', '/main/', true, req.params.campaignId);
    });

    app.get('/login', function (req, res, next) {
        sendToSSO(req, res, 'login', '/main/', true);
    });
    app.get('/signin', function (req, res, next) {
        sendToSSO(req, res, 'login', '/main/', true);
    });

    app.get('/saveUrl/', function(req, res) {
        req.saveUrl = req.query.returnUrl;
        res.redirect('/');
    });

    app.get('/forgetToken', function (req, res) {
        req.session.destroy(function (err) {
            res.redirect('/');
        });
    });

    app.get('/changepassword/:uuid', function(req, res) {
        res.redirect(config.url +'/changepassword/'+ req.params.uuid);
    });

    app.get('/saveToken/:url', function(req, res) {
        // redirect to this url after we're done with the token
        var redirectUrl = new Buffer(req.params.url, 'base64').toString('ascii');

        // as sso passes token using ?token=
        var token = req.query.token;
        req.session.token = token;
        req.session.save();

        res.redirect(redirectUrl);
    });

    fs.readFile(config.keyPath,function(err, data) {
        if(err) {
            scope.log.fatal('Failed to read private key', err);
            process.exit();
        }
        privateKey = data;
        callback();
    });
};