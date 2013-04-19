'use strict';

module.exports = function (scope, callback) {
    var server = scope.api('Server');

    server.onCall('getAccount', function (call) {
        // get account using cloudapi
        call.cloud.getAccount(call.done.bind(call));
    });

    server.onCall('listKeys', function(call) {
        // get account ssh keys
        call.cloud.listKeys(call.done.bind(call));
    })

    server.onCall('createKey', function(call) {
        // create new ssh key for this account
        call.cloud.createKey({name: call.data.name, key: call.data.key}, call.done.bind(call));
    })

    setImmediate(callback);
}