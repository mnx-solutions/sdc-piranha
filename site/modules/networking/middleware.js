'use strict';
var config = require('easy-config');

module.exports = function networkingMiddleware(req, res, next) {
    req.cloud.listDatacenters(function (error, datacenters) {
        if (error) {
            return next(error);
        }
        var networkingDatacenters = config.networkingDatacenters || [];
        networkingDatacenters = networkingDatacenters.filter(function (datacenterName) {
            return datacenters[datacenterName];
        });
        res.locals.jss = res.locals.jss || [];
        res.locals.jss.push('window.JP.set("networkingDatacenters", ' + JSON.stringify(networkingDatacenters) + ')');

        next();
    });
};
