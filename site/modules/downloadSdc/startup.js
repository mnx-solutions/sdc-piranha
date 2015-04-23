'use strict';

module.exports = function execute(log, config) {
    var server = require('../server').Server;

    if (config.features.downloadSdc !== 'enabled') {
        return;
    }

    server.onCall('getSdcInfo', function (call) {
        call.done(null, config.downloadSdc);
    });

};
