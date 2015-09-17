'use strict';
var config = require('easy-config');

module.exports = function dockerMiddleware(req, res, next) {
    res.locals.jss = res.locals.jss || [];
    res.locals.jss.push('window.JP.set("sdcDatacenters", ' + JSON.stringify(config.sdcDocker) + ')');

    return next();
};
