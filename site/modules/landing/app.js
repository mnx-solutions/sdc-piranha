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

	app.post('/ssourl', function (req, res) {

        // returnUrl will save the token and then redirect
        var baseUrl = new Buffer(req.protocol +'://'+ req.headers.host + req.body.redirectUrl).toString('base64');
        var returnUrl =   req.protocol +'://'+ req.headers.host +'/landing/saveToken/'+ baseUrl +'/';
        var ssoUrl = config.url +'/'+ req.body.method;

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

            res.json({url: ssoUrl +'?verifystring='+ encodeURIComponent(JSON.stringify(queryObj))});
        } else {
            res.json({url: ssoUrl +'?'+ querystring});
        }
    });

    app.get('/saveUrl/', function(req, res) {
        req.saveUrl = req.query.returnUrl;
        res.redirect('/');
    });

    app.get('/forgetToken', function(req, res) {
        req.session.token = null;
        req.session.save();

        res.redirect('/');
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
}