'use strict';

module.exports = function (scope, callback) {
    var server = scope.api('Server');

    server.onCall('getAccount', function (call) {
        // get account using cloudapi
        call.cloud.getAccount(call.done.bind(call));
    });

    setImmediate(callback);
}