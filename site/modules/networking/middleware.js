'use strict';
var config = require('easy-config');

module.exports = function networkingMiddleware(req, res, next) {
    res.locals.jss = res.locals.jss || [];
    res.locals.jss.push('window.JP.set("networkingDatacenters", ' + JSON.stringify(config.networkingDatacenters) + ')');

    return next();
};
