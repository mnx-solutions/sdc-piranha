'use strict';
var config = require('easy-config');

module.exports = function execute() {
    return {
        index: [
            function (req, res, next) {
                res.locals.jss = res.locals.jss || [];
                var dockerCfg = JSON.parse(JSON.stringify(config.docker));
                res.locals.jss.push('window.JP.set("dockerVersions", ' + JSON.stringify(dockerCfg || {}) + ')');
                return next();
            }
        ]
    };
};