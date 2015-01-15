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
    var updatableAccountFields = ['email', 'companyName', 'firstName', 'lastName', 'address', 'postalCode', 'city', 'state', 'country', 'phone'];

    var getBillingAndComplete = function (call, response) {
        Billing.isActive(call.req.session.userId, function (billingError, isActive) {
            call.req.session.provisionEnabled = response.provisionEnabled = isActive;
            call.req.session.save();
            call.done(billingError, response);
        });
    };

    server.onCall('getParentAccount', function (call) {
        call.cloud.getAccount(function (error, data) {
            if (error) {
                call.done(error);
                return;
            }
            call.done(null, {login: data.login, created: data.created});
        });
    });

    var updateMarketo = function (call, id, data, callback) {
        if (config.features.marketo === 'enabled') {
            Marketo.update(id, data, function (err) {
                if (err) {
                    call.log.error({error: err, data: data}, 'Failed to update marketo account');
                }
                call.log.debug(data, 'Associate Marketo lead with SOAP API');
                callback();
            });
        } else {
            setImmediate(callback);
        }
    };

    server.onCall('getAccount', function (call) {
        var subUserId = call.req.session.subId;
        var response = { isSubuser: !!subUserId};
        if (subUserId) {
            call.cloud.getUser(subUserId, function (userErr, userData) {
                if (userErr) {
                    return call.error(userErr);
                }
                accountFields.forEach(function (field) {
                    response[field] = userData[field] || '';
                });
                return getBillingAndComplete(call, response);
            });
        } else {
            // get account using cloudapi
            call.cloud.getAccount(function (error, data) {
                if (error) {
                    call.done(error);
                    return;
                }

                accountFields.forEach(function (field) {
                    response[field] = data[field] || '';
                });

                var marketoData = {
                    Email: response.email,
                    FirstName: response.firstName,
                    LastName: response.lastName,
                    Username: response.login,
                    Company: response.companyName,
                    Phone: response.phone
                };

                updateMarketo(call, response.id, marketoData, function () {
                    TFA.getSecurity(response.id, function (tfaGetError, secret) {
                        if (tfaGetError) {
                            call.done(tfaGetError);
                            return;
                        }

                        response.tfaEnabled = !!secret;
                        getBillingAndComplete(call, response);
                    });
                });
            });
        }
    });

    server.onCall('updateAccount', function (call) {
        // update account using cloudapi
        var data = {};
        updatableAccountFields.forEach(function (f) {
            data[f] = call.data[f] || null;
        });

        var subUserId = call.req.session.subId;

        if (subUserId) {
            data.id = subUserId;
            call.cloud.updateUser(data, function (userErr, userData) {
                if (userErr) {
                    return call.done(userErr);
                }
                userData.isSubuser = true;
                return getBillingAndComplete(call, userData);
            });
        } else {
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

                updateMarketo(call, account.id, marketoData, function () {
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
        }
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
                    if (err) {
                        call.req.log.error('Failed to get listKeys from cloudApi', err);
                        call.done(null);
                    } else if (!searchFromList(data, call.data)) {
                        call.done(null);
                    } else {
                        setTimeout(checkList, 2000);
                    }
                }, true);
            })();
        });
    });

    var getConfigPath = function (call, old) {
        var configPath = '~~/stor/.joyent/portal';
        if (call.req.session.parentAccount) {
            configPath += '/' + call.req.session.userId;
        }
        return configPath + '/config' + (old ? '.' + call.req.session.userName : '') + '.json';
    };

    var readFileContents = function (client, path, callback) {
        client.getFileContents(path, 'utf8', callback);
    };

    var readOldOrNewFile = function (call, client, callback) {
        var oldConfigPath = getConfigPath(call, true);
        var newConfigPath = getConfigPath(call, false);
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
            client.unlink(oldConfigPath, {}, function (rmErr) {
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
                    setTimeout(function () {
                        readOldOrNewFile(call, client, callback);
                    }, 2000);
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
        var configPath = getConfigPath(call);

        function checkResponse(callObj, error) {
            if (error) {
                callObj.req.log.error({error: error}, 'Cannot write user config');
            }
            callObj.done(null, !!error);
        }

        var putConfig = function (callObj, mantaClient) {
            return mantaClient.putFileContents(configPath, JSON.stringify(callObj.data), function (error) {

                if (error && error.statusCode === 404) {
                    mantaClient.mkdirp(configPath.substring(0, configPath.lastIndexOf('/')), function (err) {
                        if (err) {
                            checkResponse(callObj, err);
                        } else {
                            putConfig(callObj, mantaClient);
                        }
                    });
                } else {
                    checkResponse(callObj, error);
                }
            });
        };
        putConfig(call, client);
    });
};
