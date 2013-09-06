'use strict';

var fs = require('fs');
var restify = require('restify');
var config = require('easy-config');
var maxMindClient = restify.createStringClient({url: 'https://api.maxmind.com'});

if (!config.maxmind || !config.maxmind.licenseId) {
    throw new Error('MaxMind licenseId must be defined in the config');
}

var limits = {
    calls: 3,
    serviceFails: 3
};
var serviceMessages = {
    wrongPin: 'Phone verification failed. Incorrect PIN code. Please try again',
    wrongPinLocked: 'Phone verification failed. Incorrect PIN code. Your account has been locked. Please contact support',
    phoneIncorrect: 'The phone number is incorrect',
    serviceFailed: 'Verification service not accessible, please try again',
    calling: 'Calling...'
};

module.exports = function execute(scope, app) {
    var SignupProgress = scope.api('SignupProgress');
    var Metadata = scope.api('Metadata');

    function messageFilter(message) {
        if (message.indexOf('PhoneNumber Parameter') !== -1 || message.indexOf('Unable to parse phone number') !== -1) {
            message = serviceMessages.phoneIncorrect;
        }
        return message;
    };

    function lockAccount(req, res, callback) {
        Metadata.set(req.session.userId, 'verificationStatus', 'Locked', callback);
    };

    function skipVerification(req, res) {
        SignupProgress.setMinProgress(req, 'phone', function() {
            res.json({message: 'Phone verification successful', success: true, skip: true});
        });
    };

    app.get('/call/:phone', function (req, res) {
        var code = Math.random().toString(10).substr(2,4);
        req.session.maxmindCode = code;
        req.session.maxmindRetries = req.session.maxmindRetries || 0;
        req.session.maxmindServiceFails = req.session.maxmindServiceFails || 0;
        if (req.session.maxmindServiceFails >= limits.serviceFails) {
            skipVerification(req, res);
        } else if (req.session.maxmindRetries < limits.calls) {
            var encodedPhone = encodeURIComponent(req.params.phone);
            var url = '/app/telephone_http?l=' + config.maxmind.licenseId + '&phone=' + encodedPhone + '&verify_code=' + code;
            maxMindClient.get(url, function(err, creq, cres, data) {
                if (err) {
                    req.session.maxmindServiceFails++;
                    res.json({message: serviceMessages.serviceFailed, success: false});
                    return;
                }
                if (data.indexOf('err') !== 0) {
                    req.session.maxmindRetries++;
                    res.json({message: serviceMessages.calling, success: true});
                } else {
                    if (data.indexOf('Insufficient') != -1) {
                        req.session.maxmindServiceFails++;
                        res.json({message: serviceMessages.serviceFailed, success: false});
                        return;
                    }
                    var errorMessage = messageFilter(data.substring(4)); // Skip 'err='
                    res.json({message: errorMessage, success: false});
                }
            });
        } else {
            lockAccount(req, res, function () {
                res.json({message: serviceMessages.wrongPinLocked, success: false});
            });
        }
    });

    app.get('/verify/:code', function (req, res) {
        if (req.session.maxmindCode && req.params.code === req.session.maxmindCode) {
            skipVerification(req, res);
        } else {
            if (req.session.maxmindRetries >= limits.calls) {
                lockAccount(req, res, function () {
                    res.json({message: serviceMessages.wrongPinLocked, success: false});
                });
            } else {
                res.json({message: serviceMessages.wrongPin, success: false});
            }
        }
    });
};