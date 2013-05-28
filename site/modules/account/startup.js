'use strict';

var config = require('easy-config');

module.exports = function execute(scope) {
    var server = scope.api('Server');
    var TFA = scope.api('TFA');
    var SignupProgress = scope.api('SignupProgress');

    var accountFields = ['id','login','email','companyName','firstName','lastName','address','postalCode','city','state','country','phone'];
    var updateable = ['email','companyName','firstName','lastName','address','postalCode','city','state','country','phone'];

    server.onCall('getAccount', function (call) {
        // get account using cloudapi
        call.cloud.getAccount(function (err, data) {
            if(err) {
                call.done(err);
                return;
            }
            var response = {};
            accountFields.forEach(function (field) {
                response[field] = data[field] || '';

                if(field === 'phone') {
                    response[field] = response[field].replace(/[^0-9\.]+/g, '');
                }
            });
            TFA.get(data.id, function (err, secret) {
                if(err) {
                    call.done(err);
                    return;
                }
                response.tfaEnabled = !!secret;
                call.done(null, response);
            });
        });
    });

    server.onCall('updateAccount', function (call) {
        // update account using cloudapi
        var data = {};
        updateable.forEach(function (f) {
            data[f] = call.data[f] || null;
        });
        scope.log.debug('Updating account with', data);

        call.cloud.updateAccount(data, call.done.bind(call));
    });

    server.onCall('listKeys', function(call) {
        // get account ssh keys

        if(call.data.noCache) {
            call.cloud.listKeys({login: 'my'}, call.done.bind(call), call.data.noCache);
        } else {
            call.cloud.listKeys(call.done.bind(call));
        }
    });

    server.onCall('createKey', function(call) {
        // create new ssh key for this account
        call.cloud.createKey({name: call.data.name, key: call.data.key}, function (err, resp) {
            if(err) {
                call.done(err);
                return;
            }
            SignupProgress.setMinProgress(call, 'ssh', function (err2) {
                if(err2) {
                    scope.log.error(err2);
                }
                call.done(null, resp);
            });
        });
    });

    server.onCall('deleteKey', function(call) {
        // delete ssh key
        scope.log.debug('server call, delete key:', call.data.fingerprint);
        call.cloud.deleteKey(call.data.fingerprint, call.done.bind(call));
    });
};