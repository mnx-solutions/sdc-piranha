'use strict';

var data = require('./data/data.json');

module.exports = function execute(scope) {

    var server = scope.api('Server');

    server.onCall('UtilizationData', function (call) {
        call.done(null, data);
    });
}