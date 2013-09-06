'use strict';

var fs = require('fs');
var mustache = require('mustache');
var restify = require('restify');

//FIXME: FIRST AND FOREMOST: Why isn't maxmind in a separate module ??


//FIXME: Why is this not in the configuration
var maxmindLicense = 'bQg6oKXwLfWj';
var limits = {
    calls: 3,
    serviceFails: 3
};
var errorMessages = {
    wrongPin: 'Phone verification failed. Incorrect PIN code. Please try again',
    wrongPinLocked: 'Phone verification failed. Incorrect PIN code. Your account has been locked. Please contact support',
    phoneIncorrect: 'The phone number is incorrect',
    serviceFailed: 'Verification service not accessible, please try again'
};

module.exports = function execute(scope, app) {
    var SignupProgress = scope.api('SignupProgress');
    //FIXME: You have copied this from TFA, there is no need to use an api approach if it is not used in other modules
    // Just require the file
    var Metadata = scope.api('Metadata');

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

    //FIXME: We use function declaration method f.e 'function messageFilter(message)',
    // that creates a function with a name and it is seen in the stack trace.
    // Creating a function as 'var messageFilter = function (message)',
    // creates an anonymous function which has no name in the stack trace.

    var messageFilter = function (message) {
        // Always use !== or === instead of != or ==
        if (message.indexOf('PhoneNumber Parameter') != -1 || message.indexOf('Unable to parse phone number') != -1) {
            message = errorMessages.phoneIncorrect;
        }
        return message;
    };

    var lockAccount = function (req, res, callback) {
        Metadata.set(req.session.userId, 'verificationStatus', 'Locked', callback);
    };

    var skipVerification = function (req, res) {
        SignupProgress.setMinProgress(req, 'phone', function() {
            res.json({message: 'Phone verification successful', success: true, skip: true});
        });
    };

    app.get('/maxmind/call/:phone', function (req, res) {
        var code = Math.random().toString(10).substr(2,4);
        req.session.maxmindCode = code;
        req.session.maxmindRetries = req.session.maxmindRetries || 0;
        req.session.maxmindServiceFails = req.session.maxmindServiceFails || 0;
        if (req.session.maxmindServiceFails >= limits.serviceFails) {
            skipVerification(req, res);
        } else if (req.session.maxmindRetries < limits.calls) {
            //FIXME: Why create a new client every time? The same client could be used for all requests
            var client = restify.createStringClient({url: 'https://api.maxmind.com'});


            var encodedPhone = encodeURIComponent(req.params.phone);
            var url = '/app/telephone_http?l=' + maxmindLicense + '&phone=' + encodedPhone + '&verify_code=' + code;
            client.get(url, function(err, creq, cres, data) {
                if (err) {
                    req.session.maxmindServiceFails++;
                    res.json({message: errorMessages.serviceFailed, success: false});
                    return;
                }
                //FIXME: You are expecting 'err' on start position, so search for === 0,
                // something might change later on and the string occurs somewhere else as well messing up code
                var isCalling = data.indexOf('err') == -1;
                if (isCalling) {
                    req.session.maxmindRetries++;
                } else {
                    if (data.indexOf('Insufficient') != -1) {
                        req.session.maxmindServiceFails++;
                        res.json({message: errorMessages.serviceFailed, success: false});
                        return;
                    }
                    data = messageFilter(data.substring(4)); // Skip 'err='
                }
                res.json({message: data, success: isCalling});
            });
        } else {
            lockAccount(req, res, function () {
                res.json({message: errorMessages.wrongPinLocked, success: false});
            });
        }
    });

    app.get('/maxmind/verify/:code', function (req, res) {
        var isVerified = req.session.maxmindCode && req.params.code == req.session.maxmindCode;
        if (isVerified) {
            skipVerification(req, res);
        } else {
            //FIXME: Why a separate variable and what if the limit goes over?
            var shouldLock = req.session.maxmindRetries == limits.calls;
            if (shouldLock) {
                lockAccount(req, res, function () {
                    res.json({message: errorMessages.wrongPinLocked, success: false});
                });
            } else {
                res.json({message: errorMessages.wrongPin, success: false});
            }
        }
    });
};