'use strict';

module.exports = function (req, res, next) {

    if(!req.session.token) {
        // basically it's easy, if there's no token and the request is on root, we'll redirect to landing
        // if the request isn't to root it must be to a module, so we let it through this
        if(req.path == '/') {
            res.redirect('/');
        } else {
            next();
        }
    } else {
        next();
    }
}