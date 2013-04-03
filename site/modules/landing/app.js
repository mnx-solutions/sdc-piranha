'use strict';

var crypto = require("crypto");
var fs = require("fs");

module.exports = function (scope, app, callback) {

    var config = scope.config.sso;

	app.post('/ssourl', function (req, res) {
        var date = new Date().toUTCString();


        // returnUrl will save the token and then redirect
        var baseUrl = new Buffer(req.protocol +'://'+ req.headers.host + req.body.redirectUrl).toString('base64');
        var returnUrl =   req.protocol +'://'+ req.headers.host +'/landing/saveToken/'+ baseUrl +'/';
        var ssoUrl = config.url +'/'+ req.body.method;

        // get the developer private key
        var privateKey = fs.readFileSync(config.keyPath);

        // build the query string
        var querystring = "keyid=" + encodeURIComponent(config.keyId) + "&" +
            "nonce=" + encodeURIComponent(Math.random().toString(36).substring(7)) + "&" +
            "now=" + encodeURIComponent(date) + "&" +
            "permissions=" + encodeURIComponent(JSON.stringify({"cloudapi": ["/my/*"]})) + "&" +
            "returnto=" + encodeURIComponent(returnUrl);

        var signer = crypto.createSign('sha256');
        signer.update(encodeURIComponent(ssoUrl +"?" + querystring));
        var signature = signer.sign(privateKey, 'base64');
        querystring += "&sig=" + encodeURIComponent(signature);

        res.json({url: ssoUrl +'?'+ querystring});

    });

    app.get('/saveToken/:url', function(req, res) {

        // redirect to this url after we're done with the token
        var redirectUrl = new Buffer(req.params.url, 'base64').toString('ascii');

        // as sso passes token using ?token=
        var token = JSON.parse(req.query.token);

        // TODO: something with the token

       res.redirect(redirectUrl);
    });

	setImmediate(callback);
}