'use strict';

var restify = require('restify');
var config = require('easy-config');

if (!config.maxmind || !config.maxmind.licenseId) {
    throw new Error('MaxMind licenseId must be defined in the config');
}

var phoneVerificationClient = restify.createStringClient({url: config.maxmind.phoneApiUrl});

var limits = config.maxmind.limits || {
    calls: 3,
    serviceFails: 3,
    pinTries: 3
};

var serviceMessages = {
    wrongPin: 'Phone verification failed. Incorrect PIN code. Please try again',
    wrongPinTooManyTries: 'Phone verification failed. Incorrect PIN code. PIN has been locked. Please use "Call Me Now" to get a new PIN.',
    wrongPinLocked: 'Phone verification failed. Incorrect PIN code. Your account has been locked. Please contact support',
    wrongCallLocked: 'Phone verification failed. Too many calls made. Your account has been locked. Please contact support',
    phoneIncorrect: 'The phone number is incorrect',
    serviceFailed: 'Verification service not accessible, please try again',
    calling: 'Calling...'
};

module.exports = function execute(app) {
    var SignupProgress = require('../account').SignupProgress;
    var Metadata = require('../account').Metadata;

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

    function lockAccount(req, res, lockMessage) {
        lockMessage = lockMessage || serviceMessages.wrongPinLocked;
        if (req.session.maxmindLocked) { // Already locked
            res.json({message: lockMessage, success: false, navigate: true});
            return;
        }

        req.log.warn('User account is locked');
        req.session.maxmindLocked = true;
        req.session.save();
        SignupProgress.setSignupStep(req, 'blocked', function (err) {
            if (err) {
                req.log.error(err);
            }

            if (req.session.blockReason) {
                Metadata.set(req.session.userId, Metadata.BLOCK_REASON, req.session.blockReason, function (setErr) {
                    if (setErr) {
                        req.log.error({error: setErr}, 'Saving block reason in metadata failed');
                    }
                });
            }

            res.json({message: lockMessage, success: false, navigate: true});
        });
    }

    function finishVerification(req, res, success) {
        if (success) {
            req.log.info('Phone verification successful');
        } else {
            req.log.error('Maxmind phone verification service cannot be reached after %d attempts',
                limits.serviceFails);
        }

        var verificationStatus = success ? 'Successful' : 'PV service failed';
        Metadata.set(req.session.userId, Metadata.PHONE_VERIFICATION, verificationStatus, function (err) {
            if (err) {
                req.log.warn({error: err}, 'Error occurred while setting phone verification status');
            }

            req.session.maxmindServiceFails = 0;
            req.session.save();

            SignupProgress.setMinProgress(req, 'phone', function(err) {
                if (err) {
                    req.log.error(err);
                    res.json({message: 'Internal error', success: false});
                    return;
                }

                res.json({message: 'Phone verification successful', success: true, navigate: true});
            });
        });
    }

    app.get('/call/:phone', function (req, res) {
        var retries = req.session.maxmindRetries || 0;
        var serviceFails = req.session.maxmindServiceFails || 0;
        var code = Math.random().toString(10).substr(2, 4);
        req.session.maxmindCode = code;

        // Too many tries, lock account
        if (retries >= limits.calls || req.session.maxmindLocked) {
            req.session.blockReason = 'Phone verification, too many calls.  REF ID: ' + req.session.attemptId;
            lockAccount(req, res, serviceMessages.wrongCallLocked);
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

        req.log.info({phone: req.params.phone}, 'Calling user phone');

        phoneVerificationClient.get(url, function(err, creq, cres, data) {
            if (err) {
                req.log.error(err);
                req.session.maxmindServiceFails = serviceFails + 1;
                req.session.save();
                res.json({message: serviceMessages.serviceFailed, success: false});
                return;
            }

            if (data.indexOf('err') === 0) {
                var error = messageFilter(data.substring(4)); // Skip 'err='
                req.log.warn({error: error.message, phone: req.params.phone}, 'Phone verification error');
                if (error.serviceFailed) {
                    req.session.maxmindServiceFails = serviceFails + 1;
                }
                req.session.save();
                res.json({message: error.message, success: false});
                return;
            }

            if (data.indexOf('refid=') === 0) {
                req.session.attemptId = data.substr(6);
            }

            req.session.maxmindRetries = retries + 1;
            req.session.maxmindPinTries = 0; //Reset pin tries
            req.session.save();
            res.json({message: serviceMessages.calling, success: true});
        });
    });

    app.get('/verify/:code', function (req, res) {
        req.session.maxmindPinTries = req.session.maxmindPinTries || 0;

        // We are already locked?
        if (req.session.maxmindLocked) {
            lockAccount(req, res);
            return;
        }

        // Reached the limit of pin retries
        if (req.session.maxmindPinTries++ >= limits.pinTries) {
            req.session.blockReason = 'Phone verification, too many pins. ' +
                (req.session.attemptId ? 'REF ID: ' + req.session.attemptId : 'No calls made.');
            req.session.save();
            lockAccount(req, res);
            return;
        }

        req.session.save();

        // Is code correct ?
        if (req.session.maxmindCode && req.params.code === req.session.maxmindCode) {
            finishVerification(req, res, true);
            return;
        }

        req.log.info({
            generatedPin: req.session.maxmindCode,
            enteredPin: req.params.code,
            attempt: req.session.maxmindPinTries
        }, 'User entered wrong pin');

        // prompt user to change phone is he is on his last pin attempt
        var wrongPinMessage = req.session.maxmindPinTries === limits.pinTries ?
            serviceMessages.wrongPinTooManyTries : serviceMessages.wrongPin;
        res.json({message: wrongPinMessage, success: false});
    });
};
