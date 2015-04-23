'use strict';
var config = require('easy-config');

module.exports = function dashboardMiddleware(req, res, next) {
    res.locals.currentYear = new Date().getFullYear();
    res.locals.userId = req.session.userId;

    if (!res.locals.jss) {
        res.locals.jss = [];
    }
    res.locals.jss.push('window.JP.set("tritonDatacenter", "' + config.sdcDocker.datacenter + '")');

    return next();
};
