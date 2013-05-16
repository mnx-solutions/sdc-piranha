'use strict';

var crypto = require('crypto');
var fs = require('fs');

module.exports = function (scope, app, callback) {

    var config = scope.config.sso;
    var privateKey = null;

    if(!config) {
        scope.log.fatal('SSO config missing');
        process.exit();
    }

    function sendToSSO(req, res, method, redirectUrl, redirect) {

        // returnUrl will save the token and then redirect
        var baseUrl = new Buffer(req.protocol +'://'+ req.headers.host + (req.body.method === 'signup' ? '/signup/' : redirectUrl)).toString('base64');

        var returnUrl = req.protocol +'://'+ req.headers.host +'/landing/saveToken/'+ baseUrl +'/';
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
            url = ssoUrl +'?verifystring='+ encodeURIComponent(JSON.stringify(queryObj));
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

    app.get('/signup', function (req, res, next) {
        sendToSSO(req, res, 'signup', '/main/', true);
    });

    app.get('/login', function (req, res, next) {
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
        console.log(req.session);
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