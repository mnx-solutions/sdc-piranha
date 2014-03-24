'use strict';

var config = require('easy-config');

module.exports = function execute(scope) {

    var middleware = function (req, res, next) {

        res.locals.jss = res.locals.jss || [];

        res.locals.jss.push('window.JP.set("zendesk", ' + JSON.stringify(config.zendesk.zenboxInit || {}) + ')');

        next();
    };

    return {
        index: [
            middleware
        ]
    };
};