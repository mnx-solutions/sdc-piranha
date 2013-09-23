'use strict';

var restify = require('restify');
var config = require('easy-config');

if (!config.maxmind || !config.maxmind.licenseId) {
    throw new Error('MaxMind licenseId must be defined in the config');
}

var phoneVerificationClient = restify.createStringClient({url: config.maxmind.phoneApiUrl});
var fraudVerificationClient = restify.createStringClient({url: config.maxmind.fraudApiUrl});

var limits = config.maxmind.limits || {
    calls: 3,
    serviceFails: 3,
    pinTries: 3
};

var riskTiers = config.maxmind.riskTiers || {
    "tier-1": 33,
    "tier-2": 66,
    "tier-3": 100
};

var serviceMessages = {
    wrongPin: 'Phone verification failed. Incorrect PIN code. Please try again',
    wrongPinTooManyTries: 'Phone verification failed. Incorrect PIN code. PIN has been locked. Please use "Call Me Now" to get a new PIN.',
    wrongPinLocked: 'Phone verification failed. Incorrect PIN code. Your account has been locked. Please contact support',
    phoneIncorrect: 'The phone number is incorrect',
    serviceFailed: 'Verification service not accessible, please try again',
    calling: 'Calling...'
};

module.exports = function execute(scope, app) {
    var SignupProgress = scope.api('SignupProgress');
    var Metadata = scope.api('Metadata');

    function messageFilter(message) {
        if (message.indexOf('Insufficient') !== -1) {
            return {message: serviceMessages.serviceFailed, serviceFailed: true};
        }
        if (message.indexOf('PhoneNumber Parameter') !== -1 ||
            message.indexOf('Unable to parse phone number') !== -1) {

            return {message:serviceMessages.phoneIncorrect, serviceFailed: false};
        }
        return {message:message, serviceFailed: false};
    }

    function lockAccount(req, res) {
        if(req.session.maxmindLocked) { // Already locked
            res.json({message: serviceMessages.wrongPinLocked, success: false, navigate: true});
            return;
        }

        req.log.warn('Lock user account', {userId: req.session.userId});
        req.session.maxmindLocked = true;
        SignupProgress.setSignupStep(req, 'blocked', function (err) {
            if(!err) {
                req.log.warn('User account is locked', {userId: req.session.userId});
            } else {
                req.log.error('Failed to lock user account', {userId: req.session.userId, error: err});
            }
            res.json({message: serviceMessages.wrongPinLocked, success: false, navigate: true});
        });
    }

    function finishVerification(req, res, success) {
        if(success) {
            req.log.info('Phone verification successful', {userId: req.session.userId});
        } else {
            req.log.error('Maxmind phone verification service cannot be reached after %d attempts',
                            limits.serviceFails, {userId: req.session.userId});
        }
        SignupProgress.setMinProgress(req, 'phone', function(err) {
            if(err) {
                req.log.error('Failed to set user phone verification as passed',
                                {userId: req.session.userId, error: err});

                res.json({message: 'Internal error', success: false});
                return;
            }
            res.json({message: 'Phone verification successful', success: true, navigate: true});
        });
    }

    function checkBlackList(data) {
        var blacklistConfig = config.ns.blacklist || {};
        blacklistConfig.domain = blacklistConfig.domain || [];
        blacklistConfig.ip = blacklistConfig.ip || [];
        blacklistConfig.country = blacklistConfig.country || [];
        if (blacklistConfig.domain.indexOf(data.domain.toLowerCase()) !== -1) return false;
        if (blacklistConfig.ip.indexOf(data.i) !== -1) return false;
        if (blacklistConfig.country.indexOf(data.country) !== -1) return false;
        return true;
    }

    function calcRiskTier(riskScore) {
        for (var i in riskTiers) {
            var limitScore = riskTiers[i];
            if (riskScore <= limitScore) return i;
        }
        return null;
    }

    app.get('/call/:phone', function (req, res) {
        var retries = req.session.maxmindRetries || 0;
        var serviceFails = req.session.maxmindServiceFails || 0;
        var code = Math.random().toString(10).substr(2,4);
        req.session.maxmindCode = code;

        // Too many tries, lock account
        if(retries >= limits.calls || req.session.maxmindLocked) {
            lockAccount(req, res);
            return;
        }

        // Service has failed too many times, let the user through
        if (serviceFails >= limits.serviceFails) {
            finishVerification(req, res, false);
            return;
        }

        // Construct url
        var url = '/app/telephone_http?l=' + config.maxmind.licenseId +
            '&phone=' + encodeURIComponent(req.params.phone) +
            '&verify_code=' + code;

        req.log.info('Calling user phone', {userId: req.session.userId, phone: req.params.phone});
        phoneVerificationClient.get(url, function(err, creq, cres, data) {
            if (err) {
                req.log.error('Failed to contact maxmind api', err);
                req.session.maxmindServiceFails = serviceFails + 1;
                res.json({message: serviceMessages.serviceFailed, success: false});
                return;
            }

            if (data.indexOf('err') === 0) {
                var error = messageFilter(data.substring(4)); // Skip 'err='
                req.log.info('Phone verification error', {error: error.message, phone: req.params.phone});
                if(error.serviceFailed) {
                    req.session.maxmindServiceFails = serviceFails + 1;
                }
                res.json({message: error.message, success: false});
                return;
            }

            req.session.maxmindRetries = retries + 1;
            req.session.maxmindPinTries = 0; //Reset pin tries
            res.json({message: serviceMessages.calling, success: true});
        });
    });

    app.get('/verify/:code', function (req, res) {
        // We are already locked?
        if (req.session.maxmindLocked) {
            lockAccount(req, res);
            return;
        }

        // Reached the limit of retries for this pin?
        if (++req.session.maxmindPinTries > limits.pinTries) {
            // If call limit is high enough then lock account
            if (req.session.maxmindRetries >= limits.calls) {
                lockAccount(req, res);
                return;
            }
            res.json({message: serviceMessages.wrongPinTooManyTries, success: false});
            return;
        }

        // Is code correct ?
        if (req.session.maxmindCode && req.params.code === req.session.maxmindCode) {
            finishVerification(req, res, true);
            return;
        }

        req.log.info('User entered wrong pin', {
            userId: req.session.userId,
            generatedPin: req.session.maxmindCode,
            enteredPin: req.params.code
        });

        res.json({message: serviceMessages.wrongPin, success: false});
    });

    app.post('/minfraud', function (req, res) {
        var query = req.body;
        query.license_key = config.maxmind.licenseId;
        query.i = config.maxmind.tmpClientIp || req.ip; // temp config option for demo
        var result = {success: true};
        if (checkBlackList(query)) {
            fraudVerificationClient.get({path: '/app/ccv2r', query: query}, function (err, creq, cres, data) {
                if (err) {
                    SignupProgress.setMinProgress(req, 'billing', function () {
                        res.json({success: false, message: serviceMessages.serviceFailed});
                    });
                    return;
                }
                data.split(';').forEach(function (fieldStr) {
                    var keyValueArr = fieldStr.split('=');
                    if (keyValueArr.length > 1) result[keyValueArr[0]] = keyValueArr[1];
                });

                // risk score override for testing
                result.riskScore = config.maxmind.tmpRiskScore || result.riskScore;

                // temp logging for demo
                scope.log.info('maxmind fraud score detected (0.01=safest -- 99.99=maxfraud)',
                    {riskScore: result.riskScore, explanation: result.explanation});
                if (err) {
                    res.json(err);
                    return;
                }
                var riskTier = calcRiskTier(result.riskScore);
                if (riskTiers[riskTier] === 100) {
                    scope.log.warn('User was blocked due to high risk score', {userId: req.session.userId});
                    SignupProgress.setSignupStep(req, 'blocked', function () {
                        res.json(result);
                    });
                } else {
                    Metadata.set(req.session.userId, 'riskScore', riskTier, function () {
                        // Deliberately ignore possible errors and set progress anyway
                        SignupProgress.setMinProgress(req, 'billing', function () {
                            res.json(result);
                        });
                    });
                }
            });
        } else {
            scope.log.warn('User matched against black list and was blocked', {userId: req.session.userId});
            SignupProgress.setSignupStep(req, 'blocked', function () {
                res.json(result);
            });
        }
    });
};