'use strict';

var crypto = require('crypto');
var pageID = '2c92c0f83dfa51fe013e0c9fbd4c4396';
var apiKey = '8yKf8GRr0Q4G7TshWckelil1eS_BFEUIye_mG_AWZvQ=';
var host = 'https://apisandbox.zuora.com/apps/PublicHostedPaymentMethodPage.do?method=requestPage&';
var tenantID = '11111';

function createToken() {
    var lib = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var libArr = lib.split('');
    var token = '';
    var i;
    for(i = 0; i < 32; i++) {
        token += libArr[Math.round(Math.random() * lib.length) -1];
    }
    return token;
}

function createSignature(path) {
    var hash = crypto.createHash('md5');
    hash.update(path);
    var sig = hash.digest('base64');
    var urlsafe = sig.replace(/\+/g,'-').replace(/\//g,'_');
    return urlsafe;
}

module.exports = function (scope, app, callback) {

    app.get('/iframe', function (req, res, next) {
        var path = 'id=' + pageID +
            '&tenantId=' + tenantID +
            '&timestamp=' + Date.now() +
            '&token=' + createToken() + apiKey;

        var url = host + path + '&signature=' + createSignature(path);
        res.redirect(url);
    });

    setImmediate(callback);
}