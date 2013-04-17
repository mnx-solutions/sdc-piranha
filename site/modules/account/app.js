'use strict';

var crypto = require('crypto');
var conf = require('easy-config');

var pageID = conf.zuora.pageID;
var apiKey = conf.zuora.apiKey;
var tenantID = conf.zuora.tenantID;
var host = 'https://apisandbox.zuora.com/apps/PublicHostedPaymentMethodPage.do?method=requestPage&';
var action = 'https://apisandbox.zuora.com/apps/PublicHostedPaymentMethodPage.do';

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
    var hex = hash.digest('hex');
    var sig = new Buffer(hex).toString('base64');
    var urlsafe = sig.replace(/\+/g,'-').replace(/\//g,'_');
    return urlsafe;
}

module.exports = function (scope, app, callback) {

    app.get('/iframe', function (req, res, next) {
        var path = 'id=' + pageID +
            '&tenantId=' + tenantID +
            '&timestamp=' + Date.now() +
            '&token=' + createToken();

        var url = host + path + '&signature=' + createSignature(path + apiKey);
        res.send(url);
    });

    app.get('/form', function (req, res, next) {
        var form = {
            action: action,
            fields: {
                id: pageID,
                tenantID: tenantID,
                timestamp: Date.now(),
                token: createToken(),
                field_accountId: 'AccountID'
            }
        };
        var path = 'id=' + pageID +
            '&tenantId=' + tenantID +
            '&timestamp=' + form.fields.timestamp +
            '&token=' + form.fields.token;

        form.fields.signature = createSignature(path + apiKey);
        res.json(form);
    });

    setImmediate(callback);
}