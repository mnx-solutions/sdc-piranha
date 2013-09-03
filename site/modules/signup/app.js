'use strict';

var fs = require('fs');
var mustache = require('mustache');
var restify = require('restify');
var maxmindLicense = 'bQg6oKXwLfWj';
var callMaxRetries = 3;
var wrongPinMessage = 'Phone verification failed. Incorrect PIN code. Please try again';
var wrongPinLockedMessage = 'Phone verification failed. Incorrect PIN code. Your account has been locked. Please contact support';

module.exports = function execute(scope, app) {
    var SignupProgress = scope.api('SignupProgress');

    app.get('/ssh-key-generator', function (req, res, next) {
        fs.readFile(__dirname + '/static/partial/ssh-key-generator.html', function (err, data) {
            if (err) {
                res.send(500, 'Unable to generate SSH generator script');
                return;
            }

            var output = mustache.render(data.toString(), { username: req.query.username || '' });

            res.setHeader('Content-Disposition', 'attachment; filename=ssh-key-generator.sh');
            res.setHeader('Content-Type', 'application/octet-stream');
            res.send(200, output);
        });
    });

    app.get('/maxmind/call/:phone', function (req, res) {
        var code = Math.random().toString(10).substr(2,4);
        req.session.maxmindCode = code;
        req.session.maxmindRetries = req.session.maxmindRetries || 0;
        if (req.session.maxmindRetries < callMaxRetries) {
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
                res.json({message: data, success: isCalling, locked: false});
            });
        } else {
            res.json({message: 'Phone verification failed. Incorrect PIN code. Your account has been locked. Please contact support', success: false});
        }
    });

    app.get('/maxmind/verify/:code', function (req, res) {
        var isVerified = req.session.maxmindCode && req.params.code == req.session.maxmindCode;
        if (isVerified) {
            SignupProgress.setMinProgress(req, 'phone', function() {
                res.json({message: 'Phone verification successful', success: true});
            });
        } else {
            var message = req.session.maxmindRetries == callMaxRetries ? wrongPinLockedMessage : wrongPinMessage;
            res.json({message: message, success: false});
        }
    });
};