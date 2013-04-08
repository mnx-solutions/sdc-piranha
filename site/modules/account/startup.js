'use strict';

module.exports = function (scope, callback) {
    var server = scope.api('Server');

    console.log('Account module startup');

    server.onCall('getAccount', function (call) {
        var cloud = call.cloud;

        var client = cloud.proxy();

        // get account using cloudapi
        client.getAccount(call.done.bind(call));
    });

    setImmediate(callback);
}