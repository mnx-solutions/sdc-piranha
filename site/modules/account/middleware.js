'use strict';

var config = require('easy-config');

function returnPage(req, res, next, step) {
    if (req.session.signupStep !== step) {
        req.session.signupStep = step;
        req.session.save();
    }

    if (step === 'completed') {
        return next();
    }

    return res.redirect('/signup/');
}

module.exports = function accountMiddleware(req, res, next) {
    var SignupProgress = require('../account').SignupProgress;
    SignupProgress.getSignupStep(req, function(err, step) {
        if (err) {
            next(err);
            return;
        }

        if (/^\/signup/.test(req.originalUrl)) {
            next();
            return;
        }

        returnPage(req, res, next, step);
    });
};
