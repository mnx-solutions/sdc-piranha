'use strict';

var redis = require('redis');
var config = require('easy-config');

module.exports = function (scope, callback) {

    var SignupProgress = scope.api('SignupProgress');
    var ends = ['completed','complete'];

    function returnPage(req, res, next, step) {
        if(req.session.signupStep !== step) {
            req.session.signupStep = step;
            req.session.save();
        }

        if(ends.indexOf(step) > -1) {
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

            // FIXME: Temporary fix to allow ssh keygenerator download
            if (/key\-generator\.sh$/.test(req.originalUrl)) {
                next();
                return;
            }

            if (/^\/signup/.test(req.originalUrl)) {
                if (ends.indexOf(step) > -1) {
                    res.redirect('/main/');
                    return;
                }
                next();
                return;
            }

            returnPage(req, res, next, step);
        });
    };

    setImmediate(function () {
        callback(null, middleware);
    });

};