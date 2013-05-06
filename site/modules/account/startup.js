'use strict';

var config = require('easy-config');

module.exports = function (scope, callback) {
    var server = scope.api('Server');
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
            });
            call.req.session.userId = data.id;
            call.req.session.save();
            call.done(null, response);
        });
    });

    server.onCall('updateAccount', function (call) {
        // update account using cloudapi
        var data = {};
        updateable.forEach(function (f) {
            data[f] = call.data[f] || '';
        });
        scope.log.debug('Updating account with', data);

//        call.cloud.getAccount(function (err, user) {
//            if(err) {
//                call.done(err);
//                return;
//            }
//            zuora.account.update(user.id, composeZuora(data), function (err, acc) {
//                if(err && acc) { // No previous account
//                    zuora.account.create(composeZuora(data, user.id), function (err2, acc) {
//                        console.log(arguments);
//                        console.log(acc.reasons);
//                        if(err2) {
//                            call.done(err2);
//                            return;
//                        }
//                        call.cloud.updateAccount(data, call.done.bind(call));
//                    });
//                    return;
//                }
//            });
//        });
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
            SignupProgress.setMinProgress(call.req, 'ssh', function (err2) {
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

    setImmediate(callback);
};