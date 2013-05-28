'use strict';

var crypto = require('crypto');
var fs = require('fs');

module.exports = function execute(scope, app, callback) {

    var config = scope.config.sso;
    var privateKey = null;

    if(!config) {
        scope.log.fatal('SSO config missing');
        process.exit();
    }

    function sendToSSO(req, res, method, redirectUrl, redirect, campaignId) {

        // returnUrl will save the token and then redirect

        // req.protocol returned wrong protocol in some browsers
        var protocol = 'https';

        if(app.settings.env === 'development' || app.settings.env === 'staging') {
            protocol = req.protocol;
        }

        var baseUrl = new Buffer(protocol +'://'+ req.headers.host + (req.body.method === 'signup' ? '/signup/' : redirectUrl)).toString('base64');

        var returnUrl = protocol +'://'+ req.headers.host +'/landing/saveToken/'+ baseUrl +'/';
        var ssoUrl = config.url +'/'+ method;

        var date = new Date().toUTCString();
        var nonce = Math.random().toString(36).substring(7);

        // build the query string
        var querystring = 'keyid=' + encodeURIComponent(config.keyId) + '&' +
            'nonce=' + encodeURIComponent(nonce) + '&' +
            'now=' + encodeURIComponent(date) + '&' +
            'permissions=' + encodeURIComponent(JSON.stringify({'cloudapi': ['/my/*']})) + '&' +
            'returnto=' + encodeURIComponent(returnUrl);

        var signer = crypto.createSign('sha256');
        signer.update(encodeURIComponent(ssoUrl +'?' + querystring));
        var signature = signer.sign(privateKey, 'base64');
        querystring += '&sig=' + encodeURIComponent(signature);

        // do we have campaign id?
        var campaignUrl = '';
        if(campaignId || req.cookies.campaignId) {
           campaignUrl = '&cid='+ (campaignId || req.cookies.campaignId);
        }

        var url = '';
        // with signup mehtod, the url looks somewhat different
        if(req.body.method === 'signup') {
            var queryObj = {
                'keyid': config.keyId,
                'nonce': nonce,
                'now': date,
                'permissions': JSON.stringify({'cloudapi': ['/my/*']}),
                'returnto': returnUrl,
                'sig': signature
            };
            url = ssoUrl +'?verifystring='+ encodeURIComponent(JSON.stringify(queryObj)) + campaignUrl;
        } else {
            url = ssoUrl +'?'+ querystring;
        }
        if(redirect) {
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
            res.cookie('campaignId', req.params.campaignId, { maxAge: 900000, httpOnly: false});
            // faking signup button
            req.body.method = 'signup';
        }

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

    app.get('/forgetToken', function(req, res) {
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