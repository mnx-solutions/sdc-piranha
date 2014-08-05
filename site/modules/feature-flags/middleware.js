'use strict';

var config = require('easy-config');

module.exports = function execute(scope) {

    var middleware = function (req, res, next) {

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

        res.locals.jss.push('window.JP.set("features", ' + JSON.stringify(currentFeatures || {}) + ')');

        return next();
    };

    return {
        index: [
            middleware
        ]
    };
};