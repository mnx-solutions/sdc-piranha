'use strict';

var pkg = require('./data/packages.json');

module.exports = function execute(scope) {

    var server = scope.api('Server');

    server.onCall('SupportListPackages', function (call) {
        call.done(null, pkg);
    });

    server.onCall('SupportCallSales', function (call) {
        call.req.log.info('Request Call Sales ' + call.data);
    });
}