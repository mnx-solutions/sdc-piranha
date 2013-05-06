'use strict';

var redis = require('redis');
var config = require('easy-config');

module.exports = function (scope, callback) {

    var SignupProgress = scope.api('SignupProgress');

    function returnPage(req, res, next, step) {

        if(req.session.signupStep !== step) {
            req.session.signupStep = step;
            req.session.save();
        }

        if(step === 'completed') {
            return next();
        }

        return res.redirect('/signup/');
    }

    var middleware = function (req, res, next) {

        if(/^\/signup/.test(req.originalUrl) || 1) {
            next();
            return;
        }
        SignupProgress.getSignupStep(req, function(err, step) {
            if(err) {
                next(err);
                return;
            }
            returnPage(req, res, next, step);
        });
    };

    setImmediate(function () {
        callback(null, middleware);
    });

};