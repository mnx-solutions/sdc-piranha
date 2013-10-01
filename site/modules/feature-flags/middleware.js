'use strict';

var config = require('easy-config');

module.exports = function execute(scope) {

    var middleware = function (req, res, next) {

        if (!res.locals.jss) {
            res.locals.jss = [];
        }

        res.locals.jss.push('window.JP.set("features", ' + JSON.stringify(config.features || {}) + ')');

        return next();
    };

    return {
        index: [
            middleware
        ]
    };
};