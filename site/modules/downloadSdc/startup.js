'use strict';

var config = require('easy-config');

module.exports = function execute(scope) {

    if (config.features.downloadSdc !== 'enabled') {
        return;
    }

    var server = scope.api('Server');

    server.onCall('getSdcInfo', function (call) {
        call.done(null, config.downloadSdc);
    });

};
