'use strict';

var config = require('easy-config');

module.exports = function menuMiddleware(req, res, next) {
    res.locals.jss = res.locals.jss || [];
    res.locals.jss.push('window.JP.set("company", ' + JSON.stringify(config.company || {}) + ')');
    next();
};
