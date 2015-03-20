'use strict';

module.exports = function (req, res, next) {
    // basically it's easy, if there's no token and the request is on root, we'll redirect to landing
    // if the request isn't to root it must be to a module, so we let it through this
    if(!req.session.token && req.path === '/') {
        res.end('<script>location.href = "/?reload" + location.hash;</script>');
    } else {
        next();
    }
};