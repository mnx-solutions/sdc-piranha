'use strict';
var config = require('easy-config');
if (!config.features || config.features.docker !== 'enabled') {
    return;
}

module.exports = function execute() {
    return {
        index: [
            function (req, res, next) {
                res.locals.jss = res.locals.jss || [];
                var dockerCfg = JSON.parse(JSON.stringify(config.docker));
                res.locals.jss.push('window.JP.set("dockerVersions", ' + JSON.stringify(dockerCfg || {}) + ')');

                res.locals.js.push({_url: '/main/docker/term.js'});
                res.locals.js.push({_url: '/socket.io/socket.io.js'});
                return next();
            }
        ]
    };
};
