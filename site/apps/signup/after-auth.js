'use strict';

var metadata = require('../../modules/account/lib/metadata');

module.exports = function (req, res, next) {
    if (!req.session.signupStep) {
        req.session.signupStep = 'start';
        req.log.info('User is now in step phone');
        metadata.set(req.session.userId, metadata.SIGNUP_STEP, 'start', function (err) {
            if (err) {
                req.log.info('Failed to set start signup step in metadata');
            }
        });
        req.session.save();
    }
    res.locals.signupStep = req.session.signupStep;
    next();
};