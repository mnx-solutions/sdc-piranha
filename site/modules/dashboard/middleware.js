'use strict';

module.exports = function execute() {

    var middleware = function (req, res, next) {
        res.locals.currentYear = new Date().getFullYear();
        return next();
    };

    return {
        index: [
            middleware
        ]
    };
};