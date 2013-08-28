'use strict';

var restify = require('restify');

var maxmindLicense = 'bQg6oKXwLfWj';

module.exports = function execute(scope, app) {
    var serve = function (res, message, isSuccess) {
        res.json({message: message, success: Boolean(isSuccess)});
        res.end();
    };

    app.get('/reset', function (req, res) {
        delete req.session.maxmindCode;
        delete req.session.maxmindRetries;
        serve(res, 'Done', true);
    });

    app.get('/call/:phone', function (req, res) {
        var code = Math.random().toString(10).substr(2,4);
        req.session.maxmindCode = code;
        req.session.maxmindRetries = req.session.maxmindRetries || 0;
        if (req.session.maxmindRetries <= 3) {
            var client = restify.createStringClient({url: 'https://api.maxmind.com'});
            var encodedPhone = encodeURIComponent(req.params.phone);
            var url = '/app/telephone_http?l=' + maxmindLicense + '&phone=' + encodedPhone + '&verify_code=' + code;
            client.get(url, function(err, creq, cres, data) {
                var isCalling = data.indexOf('err') == -1;
                if (isCalling) {
                    req.session.maxmindRetries++;
                } else {
                    data = data.substring(4); // Skip 'err='
                }
                serve(res, data, isCalling);
            });
        } else {
            serve(res, 'No more retries', false);
        }
    });

    app.get('/verify/:code', function (req, res, next) {
        var isVerified = req.session.code && req.params.code == req.session.code;
        //TODO: Store user "phone verified" status in UFDS
        serve(res, isVerified ? 'Code ok': 'Code is wrong', isVerified);
    });
};