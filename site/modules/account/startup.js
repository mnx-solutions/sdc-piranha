'use strict';

var config = require('easy-config');
var metadata = require('./lib/metadata');
var ursa = require('ursa');

module.exports = function execute(scope) {
    var server = scope.api('Server');
    var TFA = scope.api('TFA');
    var Billing = scope.api('Billing');
    var SignupProgress = scope.api('SignupProgress');
    var Marketo = scope.api('Marketo');
    var MantaClient = scope.api('MantaClient');

    var accountFields = ['id', 'login', 'email', 'companyName', 'firstName', 'lastName', 'address', 'postalCode', 'city', 'state', 'country', 'phone', 'created'];
    var updateable = ['email', 'companyName', 'firstName', 'lastName', 'address', 'postalCode', 'city', 'state', 'country', 'phone'];

    server.onCall('getAccount', function (call) {
        // get account using cloudapi
        call.cloud.getAccount(function (error, data) {
            if (error) {
                call.done(error);
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
                TFA.get(data.id, function (tfaGetError, secret) {
                    if (tfaGetError) {
                        call.done(tfaGetError);
                        return;
                    }

                    response.tfaEnabled = !!secret;
                    Billing.isActive(data.id, function (billingError, isActive) {
                        call.req.session.provisionEnabled = response.provisionEnabled = isActive;
                        call.req.session.save();
                        call.done(billingError, response);
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
        metadata.get(call.req.session.userId, metadata.ACCOUNT_HISTORY, function (err, accountHistory) {
            if (err) {
                call.log.error({error: err}, 'Failed to get account history from metadata');
            }

            var obj = {};
            try {
                obj = JSON.parse(accountHistory);
            } catch (e) {
                obj = {};
                // json parsing failed
            }
            if (!obj || obj === null || Object.keys(obj).length === 0) {
                obj = {};
            }

            if (!obj.email) {
                obj.email = [];
            }

            if (!obj.phone) {
                obj.phone = [];
            }

            obj.email.push({ 'previousValue': data.email, 'time': Date.now()});
            obj.phone.push({ 'previousValue': data.phone, 'time': Date.now()});

            metadata.set(call.req.session.userId, metadata.ACCOUNT_HISTORY, JSON.stringify(obj), function () {});
        });

        var marketoData = {
            Email: data.email,
            FirstName: data.firstName,
            LastName: data.lastName,
            Company: data.companyName,
            Phone: data.phone
        };
        call.cloud.getAccount(function (error, account) {
            if (error) {
                call.done(error);
                return;
            }

            Marketo.update(account.id, marketoData, function (updateError) {
                if (updateError) {
                    call.log.error({error: updateError, data: marketoData}, 'Failed to update marketo account');
                }
                call.log.debug(marketoData, 'Associate Marketo lead with SOAP API');
                call.log.debug('Updating account with', data);
                call.cloud.updateAccount(data, function (updateAccountError, result) {
                    if (updateAccountError) {
                        call.done(updateAccountError);
                        return;
                    }
                    Billing.updateActive(result.id, function (err, isActive) {
                        call.req.session.provisionEnabled = result.provisionEnabled = isActive;
                        call.req.session.save();
                        call.done(err, result);
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

    function searchFromList(list, resp) {
        return Object.keys(list).some(function (key) {
            return list[key].fingerprint === resp.fingerprint;
        });
    }

    server.onCall('createKey', function (call) {

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

        call.cloud.createKey({name: call.data.name, key: call.data.key}, function (error, resp) {
            if (error) {
                call.done(error);
                return;
            }

            call.log.info(resp, 'Created (imported) SSH key');

            // hold this call until cloudApi really has this key in the list
            (function checkList() {
                call.cloud.listKeys({login: 'my'}, function (err, data) {

                    if (!err && searchFromList(data, resp)) {
                        SignupProgress.setMinProgress(call, 'ssh', function (err2) {
                            if (err2) {
                                call.log.error(err2);
                            }
                            call.done(null, resp);
                        });
                    } else {
                        setTimeout(checkList, 2000);
                    }
                }, true);
            })();
        });
    });

    server.onCall('deleteKey', function (call) {
        // delete ssh key
        call.log.debug('server call, delete key:', call.data.fingerprint);
        call.cloud.deleteKey(call.data.fingerprint, function (error) {
            if (error) {
                call.done(error);
            }

            // hold this call until cloudApi really has this key in the list
            (function checkList() {
                call.cloud.listKeys({login: 'my'}, function (err, data) {
                    if (!searchFromList(data, call.data)) {
                        call.done(null);
                    } else {
                        setTimeout(checkList, 2000);
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
        client.getFileContents(path, 'utf8', callback);
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
        var attempt = 5;
        var callback = function (err, result) {
            if (err) {
                if (err.statusCode === 404) {
                    call.req.log.info('Config for user not found');
                } else if (err.name === 'AccountBlockedError' && err.code === 'AccountBlocked' && attempt > 0 && call.req.session.provisionEnabled) {
                    attempt -= 1;
                    setTimeout(function () {readOldOrNewFile(call, client, callback); }, 2000);
                    return;
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
        };
        readOldOrNewFile(call, client, callback);
    });

    server.onCall('SetUserConfig', function (call) {
        var client = MantaClient.createClient(call);
        client.putFileContents(getConfigPath(call, client), JSON.stringify(call.data), function (error) {
            if (error && error.statusCode !== 404) {
                call.req.log.error({error: error}, 'Cannot write user config');
            }
            call.done(null, !!error);
        });
    });
};