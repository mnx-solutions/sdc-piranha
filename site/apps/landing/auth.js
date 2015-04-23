'use strict';

module.exports = function landingAuthMiddleware(req, res, next) {
    if (req.session && req.session.token && (req.originalUrl === '/' || req.originalUrl === '')) {
        res.redirect('/main');
        return;
    }
    next();
};
