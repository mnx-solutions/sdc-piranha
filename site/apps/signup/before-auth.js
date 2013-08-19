'use strict';

module.exports = function (req, res, next) {

    // if session expires (or is not there) redirect to root
    if(!req.session.token && req.path === '/') {
        res.redirect('/');
    } else {
        next();
    }
};