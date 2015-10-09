'use strict';

var config = require('easy-config');

module.exports = function featureFlagsMiddleware(req, res, next) {

    if (!res.locals.jss) {
        res.locals.jss = [];
    }
    var currentFeatures = JSON.parse(JSON.stringify(config.features));

    if (req.session && req.session.subId) {
        config.subUserDenied.some(function (item) {
            currentFeatures[item] = 'disabled';
        });
    }

    if (currentFeatures.slb !== 'disabled' && currentFeatures.limitedSlb !== 'disabled' && config.ns['allowed-slb-cuuids'].indexOf(req.session.userId) === -1) {
        currentFeatures.slb = 'disabled';
    }

    if (config.isProduction()) {
        currentFeatures.production = 'enabled';
        res.locals.jss.push('window.JP.set("wsPort", ' + (config.wsPort || 8443) + ')');
    }
    res.locals.jss.push('window.JP.set("features", ' + JSON.stringify(currentFeatures || {}) + ')');
    res.locals.jss.push('window.JP.set("companyName", ' + JSON.stringify(config.companyName || '') + ')');

    return next();
};
