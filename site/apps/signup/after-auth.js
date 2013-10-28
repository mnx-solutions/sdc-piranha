'use strict';

module.exports = function (req, res, next) {
    if(!req.session.signupStep) {
        req.session.signupStep = 'start';
        req.log.info('User is now in step phone');
        req.session.save();
    }
    res.locals.signupStep = req.session.signupStep;
    next();
};