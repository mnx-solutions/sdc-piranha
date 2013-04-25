'use strict';

var redis = require('redis');
var config = require('easy-config');

module.exports = function (scope, callback) {

    var SignupProgress = scope.api('SignupProgress');

    function returnPage(req, res, next, step, dontSave) {

        if(!dontSave) {
            req.session.signupStep = step;
            req.session.save();
        }

        if(step === 'completed') {
            return next();
        }

        res.redirect('/signup');
    }

    var middleware = function (req, res, next) {

        //TODO: when signup is ready, remove this
        next();
        return;

        if(req.session.signupStep) {
            return returnPage(req, res, next, req.session.signupStep, true);
        }

        SignupProgress.getTokenVal(req.session.token, function (err, val) {
            if(err) {
                return next(err);
            }
            if(val) {
                return returnPage(req, res, next, val);
            }
            SignupProgress.getAccountVal(req.cloud, function (err, value) {
                if(err) {
                    return next(err);
                }
                if(!value) {
                    //TODO: Wheres your god now?
                    value = 'start';
                }
                SignupProgress.setTokenVal(req.session.token, value, true, function (err) {
                    if(err) {
                        return next(err);
                    }
                    return returnPage(req, res, next, value);
                });
            });
        });
    };

    setImmediate(callback);

};