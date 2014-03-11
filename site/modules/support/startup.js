'use strict';

var pkg = require('./data/packages.json');

module.exports = function execute(scope) {

    var server = scope.api('Server');

    server.onCall('SupportListPackages', function (call) {
        call.done(null, pkg);
    });
}