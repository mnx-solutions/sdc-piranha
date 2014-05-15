'use strict';

var config = require('easy-config');

module.exports = function execute(scope) {
    var SignupProgress = scope.api('SignupProgress');

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

    var middleware = function (req, res, next) {
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

    return middleware;
};