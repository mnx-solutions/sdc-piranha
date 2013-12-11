'use strict';

var config = require('easy-config');
var metadata = require('./lib/metadata');

module.exports = function execute(scope) {
    var server = scope.api('Server');
    var TFA = scope.api('TFA');
    var SignupProgress = scope.api('SignupProgress');
    var Marketo = scope.api('Marketo');

    var accountFields = ['id','login','email','companyName','firstName','lastName','address','postalCode','city','state','country','phone'];
    var updateable = ['email','companyName','firstName','lastName','address','postalCode','city','state','country','phone'];

    server.onCall('getAccount', function (call) {
        // get account using cloudapi
        call.cloud.getAccount(function (err, data) {
            if (err) {
                call.done(err);
                return;
            }

            var response = {};
            accountFields.forEach(function (field) {
                response[field] = data[field] || '';
            });

            TFA.get(data.id, function (err, secret) {
                if (err) {
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

        var marketoData = {Email: data.email, Phone: data.phone};
        Marketo.update(call.req.session.userId, marketoData, function (err) {
            if(err) {
                call.log.error({error: err, data: marketoData}, 'Failed to update marketo account');
                return;
            }

            // get metadata
            metadata.get(call.req.session.userId, metadata.ACCOUNT_HISTORY, function(err, data) {
                if(err) {
                    call.log.error({error: err}, 'Failed to get account history from metadata');
                }

                var obj = {};
                try {
                    obj = JSON.parse(data);
                } catch(e) {
                    obj = {};
                    // json parsing failed
                }
                if(!obj || obj === null || Object.keys(obj).length === 0 || !(obj.marketo_data instanceof Array))  {
                    obj = {};
                    obj['email'] = [];
                    obj['phone'] = [];
                }


                obj['email'].push({ 'previousValue': data.email, 'time': Date.now()});
                obj['phone'].push({ 'previousValue': data.phone, 'time': Date.now()});

                metadata.set(call.req.session.userId, metadata.ACCOUNT_HISTORY, JSON.stringify(obj), function() {});
            });
        });

        call.log.debug('Updating account with', data);
        call.cloud.updateAccount(data, call.done.bind(call));
    });

    server.onCall('listKeys', function (call) {
        var serveKeys = function (err, data) {
            if (!err && data) {
                data = data.filter(function (key) {
                    return config.showSLBObjects || key.name !== 'ssc_public_key';
                });
            }
            call.done(err, data);
        };

        // get account ssh keys
        if (call.data.noCache) {
            call.cloud.listKeys({ login: 'my' }, serveKeys, call.data.noCache);
        } else {
            call.cloud.listKeys(serveKeys);
        }
    });

    function searchFromList(list, resp, cb) {
        return Object.keys(list).some(function(key) {
            if(list[key].fingerprint === resp.fingerprint) {
                return true;
            }
        });
    }

    server.onCall('createKey', function(call) {

        console.log('creating key');
        // create new ssh key for this account
        call.cloud.createKey({name: call.data.name, key: call.data.key}, function (err, resp) {
            if(err) {
                call.done(err);
                return;
            }

            // hold this call until cloudApi really has this key in the list
            (function checkList() {
                call.cloud.listKeys({login: 'my'}, function(err, data) {

                    if(searchFromList(data, resp)) {
                        SignupProgress.setMinProgress(call, 'ssh', function (err2) {
                            if(err2) {
                                call.log.error(err2);
                            }
                            call.done(null, resp);
                        });
                    } else {
                        setTimeout(checkList, 2000)
                    }
                }, true);
            })();
        });
    });

    server.onCall('deleteKey', function(call) {
        // delete ssh key
        call.log.debug('server call, delete key:', call.data.fingerprint);
        call.cloud.deleteKey(call.data.fingerprint, function(err) {
            if(err) {
                call.done(err);
            }

            // hold this call until cloudApi really has this key in the list
            (function checkList() {
                call.cloud.listKeys({login: 'my'}, function(err, data) {
                    if(!searchFromList(data, call.data)) {
                        call.done(null);
                    } else {
                        setTimeout(checkList, 2000)
                    }
                }, true);
            })();
        });
    });
};