'use strict';

module.exports = function (scope, callback) {
    var server = scope.api('Server');

    server.onCall('getAccount', function (call) {
        // get account using cloudapi
        call.cloud.getAccount(call.done.bind(call));
    });

    server.onCall('listKeys', function(call) {
        // get account ssh keys

        if(call.data.noCache) {
            console.log('no cache refresh');
            call.cloud.listKeys({login: 'my'}, call.done.bind(call), call.data.noCache);
        } else {
            call.cloud.listKeys(call.done.bind(call));
        }
    })

    server.onCall('createKey', function(call) {
        // create new ssh key for this account
        call.cloud.createKey({name: call.data.name, key: call.data.key}, call.done.bind(call));
    })

    server.onCall('deleteKey', function(call) {
        // delete ssh key
        console.log('server call, delete key:', call.data.fingerprint);
        call.cloud.deleteKey(call.data.fingerprint, call.done.bind(call));
    })
    setImmediate(callback);
}