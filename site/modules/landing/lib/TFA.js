'use strict';
var metadata = require('../../account/lib/metadata');
var tfaProvider = require('../../tfa/lib/TFAProvider');
var util = require('util');

/**
 * if toggling security to a new value,
 *   then update capi
 *   and  show the secret key QR code for this session
 */
var updateMoreSecurity = function (req, res, next) {
    if (!req.body.account) {
        return next();
    }

    var enableTFA = req.body.account.security && !(req.session.tfaEnabled || req.session.visibleSecretKey);
    var disableTFA = !req.body.account.security && (req.session.tfaEnabled || req.session.visibleSecretKey);

    if (disableTFA) {
        req.session.tfaEnabled = false;
        req.session.visibleSecretKey = false;
        req.session.save();
        metadata.setSecurity(req.session.uuid, false);
        next();
    }
    if (enableTFA) {
        tfaProvider.generateSecret(req.session.uuid, function (err, secretkey) {
            // store & show secret key for ONLY this session
            req.session.visibleSecretKey = secretkey;
            req.session.save();
            res.redirect('/account/twofactor');
        });
    }
    if (!disableTFA && !enableTFA) {
        next();
    }
};

var showInstructions = function (req, res, next) {
    if (!req.session.visibleSecretKey) {
        return next();
    }
    res.render(
        util.view('account/twofactorInstructions.ejs'),
        {
            locals: {
                qrcodeurl: getQRcode(req.session.visibleSecretKey, req.session.username)
            }
        }
    );
};

var checkExampleCode = function (req, res, next) {
    // ONLY ENABLE two-factor IF the user can actually generate a code

    var secretkey = req.session.visibleSecretKey;
    var testpass  = req.body.otpass;
    if (!secretkey || !testpass) {
        return next();
    }

    // if passes, then make it real..
    tfaProvider.generateOTP(secretkey, function(err, onetimepass) {
        if (testpass === onetimepass) {
            req.flash('info', 'Two-factor authentication enabled');
            metadata.setSecurity(req.session.uuid, secretkey, function(err, secretkey) {
                // tfaEnabled will be enabled for their next login
                delete req.session.visibleSecretKey;
                req.session.tfaEnabled = secretkey;
                req.session.tfaVerified = true;
                req.session.save();
                next();
            });
        } else {
            req.flash('error', 'Sorry, your code did not match. Try again.');
            next();
        }
    });
};

var setSecurityCheckbox = function (req, account) {
    if (req.session.tfaEnabled || req.session.visibleSecretKey) {
        account.security = 'true'
    }
    return account;
};

var isLoggedIn = function (req) {
    var session = req.session;
    return session.tfaEnabled ? session.tfaVerified : !!session.username;
};

var isVerified = function(req, res, next) {
    var session = req.session;
    if (session.tfaEnabled && !session.tfaVerified) {
        return res.redirect('/login');
    }
    next();
};

var showChallenge = function (req, res, next) {
    var sess = req.session;
    if (sess.username && sess.tfaEnabled && !sess.tfaVerified) {
        return res.render(util.view('account/twofactor.ejs'), {layout: util.view('layouts/layout_unauth')});
    }
    next();
};

var verifyChallenge = function (req, res, next) {
    if (req.body.otpass) {
        var sess = req.session;
        if (sess.username && sess.tfaEnabled && !sess.tfaVerified) {
            generateOTP(sess.tfaEnabled, function (err, otpassExpected) {
                if (req.body.otpass === otpassExpected) {
                    sess.tfaVerified = true;
                } else {
                    req.flash('error', 'Please try again.');
                    //console.log('the expected one time password: ', otpassExpected);
                    //console.log('failed TFA attempt')
                }
                next();
            });
        } else {
            next();
        }
    } else {
        next();
    }
};

var generateOTP =  tfaProvider.generateOTP;
var getQRcode =    tfaProvider.getQRcode;
var getSecretKey = metadata.getSecurity;

module.exports = {
    isTwoFactorEnabled:  isTwoFactorEnabled,
    isVerified:          isVerified,
    showChallenge:       showChallenge,
    verifyChallenge:     verifyChallenge,
    updateMoreSecurity:  updateMoreSecurity,
    showInstructions:    showInstructions,
    setSecurityCheckbox: setSecurityCheckbox,
    checkExampleCode:    checkExampleCode,
    isLoggedIn:          isLoggedIn,
    generateOTP:         generateOTP,
    getQRcode:           getQRcode,
    getSecretKey:        getSecretKey
};
