'use strict';

var mainAuth = require('../../auth.js');

module.exports = function (req, res, next) {
    mainAuth(req, res, function () {
        if(!req.session.signupStep) {
            req.session.signupStep = 'start';
            req.session.save();
        }
        res.locals.signupStep = req.session.signupStep;
        next();
    });
};