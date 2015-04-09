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
                res.locals.jss.push('window.JP.set("dockerVersions", ' + JSON.stringify(config.docker) + ')');
                if (config.features.sdcDocker === 'enabled' && config.sdcDocker.datacenter) {
                    res.locals.jss.push('window.JP.set("sdcDockerDatacenter", "' + config.sdcDocker.datacenter + '")');
                }

                res.locals.js.push({_url: '/main/docker/term.js'});
                return next();
            }
        ]
    };
};
