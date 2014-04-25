'use strict';

var config = require('easy-config');
var metadata = require('./lib/metadata');
var MemoryStream = require('memorystream');
var ursa = require('ursa');

module.exports = function execute(scope) {
    var server = scope.api('Server');
    var TFA = scope.api('TFA');
    var Billing = scope.api('Billing');
    var SignupProgress = scope.api('SignupProgress');
    var Marketo = scope.api('Marketo');
    var MantaClient = scope.api('MantaClient');

    var accountFields = ['id','login','email','companyName','firstName','lastName','address','postalCode','city','state','country','phone','created'];
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

            var marketoData = {
                Email: data.email,
                FirstName: data.firstName,
                LastName: data.lastName,
                Username: data.login,
                Company: data.companyName,
                Phone: data.phone
            };

            Marketo.update(data.id, marketoData, function (err) {
                if (err) {
                    call.log.error({error: err, data: marketoData}, 'Failed to update marketo account');
                }
                call.log.debug(marketoData, 'Associate Marketo lead with SOAP API');
                TFA.get(data.id, function (err, secret) {
                    if (err) {
                        call.done(err);
                        return;
                    }

                    response.tfaEnabled = !!secret;
                    Billing.isActive(data.id, function (err, isActive) {
                        response.provisionEnabled = isActive;
                        call.done(null, response);
                    });
                });
            });
        });
    });

    server.onCall('updateAccount', function (call) {
        // update account using cloudapi
        var data = {};
        updateable.forEach(function (f) {
            data[f] = call.data[f] || null;
        });

        // get metadata
        metadata.get(call.req.session.userId, metadata.ACCOUNT_HISTORY, function(err, accountHistory) {
            if(err) {
                call.log.error({error: err}, 'Failed to get account history from metadata');
            }

            var obj = {};
            try {
                obj = JSON.parse(accountHistory);
            } catch(e) {
                obj = {};
                // json parsing failed
            }
            if(!obj || obj === null || Object.keys(obj).length === 0)  {
                obj = {};
            }

            if(!obj.email) {
                obj.email = [];
            }

            if(!obj.phone) {
                obj.phone = [];
            }

            obj.email.push({ 'previousValue': data.email, 'time': Date.now()});
            obj.phone.push({ 'previousValue': data.phone, 'time': Date.now()});

            metadata.set(call.req.session.userId, metadata.ACCOUNT_HISTORY, JSON.stringify(obj), function() {});
        });

        var marketoData = {
            Email: data.email,
            FirstName: data.firstName,
            LastName: data.lastName,
            Company: data.companyName,
            Phone: data.phone
        };
        call.cloud.getAccount(function (err, account) {
            if (err) {
                call.done(err);
                return;
            }

            Marketo.update(account.id, marketoData, function (err) {
                if (err) {
                    call.log.error({error: err, data: marketoData}, 'Failed to update marketo account');
                }
                call.log.debug(marketoData, 'Associate Marketo lead with SOAP API');
                call.log.debug('Updating account with', data);
                call.cloud.updateAccount(data, function (err, result) {
                    if (err) {
                        call.done(err);
                        return;
                    }
                    Billing.updateActive(result.id, function (err, isActive) {
                        result.provisionEnabled = isActive;
                        call.done(null, result);
                    });
                });
            });
        });

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

        // create new ssh key for this account
        if (!call.data.name) {
            try {
                var pubKey = ursa.openSshPublicKey(call.data.key);
                var fingerprintHex = pubKey.toPublicSshFingerprint('hex');
                call.data.name = fingerprintHex.slice(-10);
            } catch (e) {
                call.done({message: 'key is invalid'});
                return;
            }

        }
        call.cloud.createKey({name: call.data.name, key: call.data.key}, function (err, resp) {
            if(err) {
                call.done(err);
                return;
            }

            call.log.info(resp, 'Created (imported) SSH key');

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

    var getConfigPath = function (call, client, old) {
        return '/' + client.user + '/stor' +  (old ? '' : '/.joyent') + '/portal/config.' +
            call.req.session.userName + '.json';
    };

    var readFileContents = function (client, path, callback) {
        client.get(path, function (err, stream) {
            if (err) {
                callback(err);
                return;
            }
            var result = '';
            stream.setEncoding('utf8');
            stream.on('data', function (data) {
                result += data;
            });
            stream.on('end', function () {
                callback(null, result);
            });
            stream.on('error', function (error) {
                callback(error);
            });
        });
    };

    var readOldOrNewFile = function (call, client, callback) {
        var oldConfigPath = getConfigPath(call, client, true);
        var newConfigPath = getConfigPath(call, client, false);
        readFileContents(client, oldConfigPath, function (oldErr, oldResult) {
            if (oldErr) {
                if (oldErr.statusCode !== 404) {
                    callback(oldErr);
                    return;
                }
                readFileContents(client, newConfigPath, function (newErr, newResult) {
                    if (newErr) {
                        callback(newErr);
                        return;
                    }
                    callback(null, newResult);
                });
                return;
            }
            client.rmr('/' + client.user + '/stor/portal', function (rmErr) {
                if (rmErr) {
                    call.req.log.info('Cannot remove old user config');
                }
                callback(null, oldResult);
            });
        });
    };

    server.onCall('GetUserConfig', function (call) {
        var client = MantaClient.createClient(call);
        readOldOrNewFile(call, client, function (err, result) {
            if (err) {
                if (err.statusCode === 404) {
                    call.req.log.info('Config for user not found');
                } else {
                    call.req.log.error({error: err}, 'Cannot read user config');
                }
                call.done(null, {});
                return;
            }
            var jsonConfig = {};
            try {
                jsonConfig = JSON.parse(result);
            } catch (ex) {
                call.req.log.error({error: ex}, 'Error parsing config file');
            }
            call.done(null, jsonConfig);
        });
    });

    server.onCall('SetUserConfig', function (call) {
        var client = MantaClient.createClient(call);
        var fileStream = new MemoryStream(JSON.stringify(call.data), {writable: false});
        client.put(getConfigPath(call, client), fileStream, {mkdirs: true}, function (error, response) {
            if (error && error.statusCode !== 404) {
                call.req.log.error({error: error}, 'Cannot write user config');
            }
            call.done(null, !!error);
        });
    });
};