'use strict';

var mainAuth = require('../../auth.js');

module.exports = [ mainAuth,
    function (req, res, next) {
        if(!req.session.signupStep) {
            req.session.signupStep = 'start';
            req.session.save();
        }
        res.locals.signupStep = req.session.signupStep;
        next();
    }];