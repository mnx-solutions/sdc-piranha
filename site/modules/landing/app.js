'use strict';

var crypto = require('crypto');
var fs = require('fs');

module.exports = function execute(app, log, config) {
    var privateKey = null;

    if (!config.sso) {
        log.fatal('SSO config missing');
        process.exit();
    }

    function sendToSSO(req, res, method, redirectUrl, redirect, campaignId) {
        // returnUrl will save the token and then redirect
        // req.protocol returned wrong protocol in some browsers
        var protocol = 'https';

        if (app.settings.env === 'development' || app.settings.env === 'staging') {
            protocol = req.protocol;
        }

        var baseUrl = new Buffer(protocol + '://' + req.headers.host + redirectUrl).toString('base64');
        baseUrl = baseUrl.replace(/\//g, '-');
        var returnUrl = protocol + '://' + req.headers.host + '/tfa/saveToken/' + baseUrl + '/';
        var ssoUrl = config.sso.url + '/' + method;

        var date = new Date().toUTCString();
        var nonce = Math.random().toString(36).substring(7);

        var brandingEnabled = config.features.useBrandingOrange === 'enabled';
        var phoneVerificationDisabled = config.features.phoneVerification !== 'enabled';

        // build the query string
        campaignId = typeof (campaignId) !== 'undefined' ? campaignId : req.cookies.campaignId;
        var querystring =
            (brandingEnabled && config.features.allowSkipBilling === 'enabled' ? 'allowSkipBilling=true&' : '') +
            (brandingEnabled ? 'branding=orange&' : '') +
            (campaignId ? 'cid=' + campaignId + '&' : '') +
            (brandingEnabled && phoneVerificationDisabled ? 'hideVerify=true&' : '') +
            'keyid=' + encodeURIComponent(config.sso.keyId) + '&' +
            'nonce=' + encodeURIComponent(nonce) + '&' +
            'now=' + encodeURIComponent(date) + '&' +
            'permissions=' + encodeURIComponent(JSON.stringify({'cloudapi': ['/my/*']})) + '&' +
            'returnto=' + encodeURIComponent(returnUrl);

        var signer = crypto.createSign('sha256');
        signer.update(encodeURIComponent(ssoUrl + '?' + querystring));
        var signature = signer.sign(privateKey, 'base64');
        querystring += '&sig=' + encodeURIComponent(signature);

        var url = ssoUrl + '?' + querystring;
        if (redirect) {
            res.redirect(url);
            return;
        }

        res.json({url: url});
    }

    function getRedirectCampaignId(campaignId, deep) {
        deep = deep || 0;
        var campaign = config.ns['campaigns'][campaignId];
        if (campaign && typeof (campaign['redirect']) !== 'undefined' && deep < 10) {
            deep += 1;
            return getRedirectCampaignId(campaign['redirect'], deep);
        }
        return campaignId;
    }
    app.post('/ssourl', function (req, res, next) {
        sendToSSO(req, res, req.body.method, req.body.redirectUrl);
    });

    app.get('/signup/:campaignId?', function (req, res, next) {
        var campaignId = req.params.campaignId;
        var redirectUrl = '/main/';

        if (campaignId) {
            var campaignDetails =  config.ns['campaigns'][campaignId];
            if (campaignDetails && campaignDetails.redirect) {
                campaignDetails =  config.ns['campaigns'][campaignDetails.redirect];
            }
            if (campaignDetails && campaignDetails.signupRedirectUrl) {
                redirectUrl = campaignDetails.signupRedirectUrl;
                res.cookie('signupRedirectUrl', redirectUrl);
            } else {
                res.clearCookie('signupRedirectUrl');
            }
            campaignId = getRedirectCampaignId(campaignId);
            // set campaign id to the cookie
            req.log.debug({campaignId: campaignId}, 'campaignId cookie set for user');
            if (campaignId) {
                res.cookie('campaignId', campaignId, {maxAge: 900000, httpOnly: false});
            } else {
                res.clearCookie('campaignId');
            }
            // faking signup button
            req.body.method = 'signup';
        } else {
            res.clearCookie('signupRedirectUrl');
        }
        req.log.info({campaignId: campaignId}, 'User landed on signup url');
        sendToSSO(req, res, 'signup', redirectUrl, true, campaignId);
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
        res.redirect(config.sso.url + '/changepassword/' + req.params.uuid);
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

    fs.readFile(config.sso.keyPath, function(err, data) {
        if (err) {
            log.fatal('Failed to read private key', err);
            process.exit();
        }
        privateKey = data;
    });
};
