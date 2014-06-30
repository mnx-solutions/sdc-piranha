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
    var updatableUserFields = ['id', 'email', 'companyName', 'firstName', 'lastName', 'address', 'postalCode', 'city', 'state', 'country', 'phone'];
    var roleFields = ['name', 'members', 'default_members', 'name', 'policies'];
    var updatableRoleFields = ['id', 'name', 'members', 'default_members', 'policies'];
    var policyFields = ['name', 'rules', 'description'];
    var updatablePolicyFields = ['id', 'name', 'rules', 'description'];

    var filterFields = function (callData, filter, skipIfEmpty) {
        var data = {};
        filter.forEach(function (f) {
            if (!skipIfEmpty || (typeof (callData[f]) === 'string' || (callData[f] && callData[f].length > 0))) {
                data[f] = callData[f] || null;
            }
        });
        return data;
    };

    var updateRoleTags = function (cloudapi, log) {
        var validResources = [
            '', 'machines', 'users', 'roles', 'packages',
            'images', 'policies', 'keys', 'datacenters',
            'analytics', 'fwrules', 'networks', 'instrumentations'
        ];
        cloudapi.listRoles(function (err, roles) {
            roles = roles || [];
            var getUserResources = {};
            cloudapi.listPolicies(function (err, policies) {
                var roleNames = [];
                roles.forEach(function (role) {
                    roleNames.push(role.name);

                    if (role.default_members && role.default_members.length > 0) {
                        role.policies.forEach(function (policyName) {
                            var policiesWithGetUser = policies.filter(function (policy) {
                                if (policy.name !== policyName) {
                                    return false;
                                }
                                var getUserRules = policy.rules.filter(function (rule) {
                                    return rule.toLowerCase().indexOf('getuser') !== -1 ||
                                        rule.toLowerCase().indexOf('updateuser') !== -1;
                                });
                                return getUserRules.length > 0;
                            });

                            if (policiesWithGetUser.length > 0) {
                                role.default_members.forEach(function (defaultMember) {
                                    getUserResources[defaultMember] = getUserResources[defaultMember] || [];
                                    if (getUserResources[defaultMember].indexOf(role.name) === -1) {
                                        getUserResources[defaultMember].push(role.name);
                                    }
                                });
                            }
                        });
                    }
                });
                var defaultMembers = Object.keys(getUserResources);
                if (defaultMembers.length > 0) {
                    cloudapi.listUsers(function (err, users) {
                        var userByLogin = {};
                        users.forEach(function (user) {
                            userByLogin[user.login] = user;
                        });
                        defaultMembers.forEach(function (defaultMember) {
                            if (userByLogin[defaultMember]) {
                                cloudapi.setRoleTags('/my/users/' + userByLogin[defaultMember].id, getUserResources[defaultMember], function (err) {
                                    if (err) {
                                        log.error({error: err}, 'Failed setRoleTags');
                                    }
                                });
                            }
                        });
                    });
                }
                validResources.forEach(function (resource) {
                    cloudapi.setRoleTags('/my/' + resource, roleNames, function (err, data) {});
                });
            });
        });
    };

    var getBillingAndComplete = function (call, response) {
        Billing.isActive(response.id, function (billingError, isActive) {
            call.req.session.provisionEnabled = response.provisionEnabled = isActive;
            call.req.session.save();
            call.done(billingError, response);
        });
    };

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

            response.isSubuser = !!call.req.session.subId;
            if (response.isSubuser) {
                call.cloud.getUser(call.req.session.subId, function (userErr, userData) {
                    if (userErr) {
                        return call.error(userErr);
                    }
                    accountFields.forEach(function (field) {
                        response[field] = userData[field] || response[field];
                    });
                    return getBillingAndComplete(call, response);
                });
            } else {
                var marketoData = {
                    Email: response.email,
                    FirstName: response.firstName,
                    LastName: response.lastName,
                    Username: response.login,
                    Company: response.companyName,
                    Phone: response.phone
                };

                Marketo.update(response.id, marketoData, function (err) {
                    if (err) {
                        call.log.error({error: err, data: marketoData}, 'Failed to update marketo account');
                    }
                    call.log.debug(marketoData, 'Associate Marketo lead with SOAP API');
                    TFA.get(response.id, function (tfaGetError, secret) {
                        if (tfaGetError) {
                            call.done(tfaGetError);
                            return;
                        }

                        response.tfaEnabled = !!secret;
                        getBillingAndComplete(call, response);
                    });
                });
            }
        });
    });
    server.onCall('listUsers', function (call) {
        call.cloud.listUsers(function (err, data) {
            call.done(err, data);

        });
    });
    server.onCall('getUser', function (call) {
        var userId = call.data.id || call.req.session.subId;
        call.cloud.getUser({id: userId, membership: true}, function (err, data) {
            call.done(err, data);
        });
    });

    server.onCall('listRoles', function (call) {
        call.cloud.listRoles(function (err, data) {
            call.done(err, data);
        });
    });

    server.onCall('createRole', function (call) {
        var data = filterFields(call.data, roleFields, true);

        call.cloud.createRole(data, function (err, data) {
            call.done(err, data);
            if (!err) {
                updateRoleTags(call.cloud, call.log);
            }
        });
    });

    server.onCall('updateRole', function (call) {
        var data = filterFields(call.data, updatableRoleFields);

        call.cloud.updateRole(data, function (err, data) {
            call.done(err, data);
            if (!err) {
                updateRoleTags(call.cloud, call.log);
            }
        });
    });

    server.onCall('deleteRole', function (call) {
        call.cloud.deleteRole(call.data.id, function (err, data) {
            call.done(err, data);
        });
    });

    server.onCall('getRole', function (call) {
        call.cloud.getRole(call.data.id, function (err, data) {
            call.done(err, data);
        });
    });

    server.onCall('listPolicies', function (call) {
        call.cloud.listPolicies(function (err, data) {
            call.done(err, data);

        });
    });

    server.onCall('getPolicy', function (call) {
        call.cloud.getPolicy(call.data.id, function (err, data) {
            call.done(err, data);
        });
    });

    server.onCall('createPolicy', function (call) {
        var data = filterFields(call.data, policyFields);
        call.cloud.createPolicy(data, function (err, data) {
            call.done(err, data);
        });
    });

    server.onCall('updatePolicy', function (call) {
        var data = filterFields(call.data, updatablePolicyFields, true);
        call.cloud.updatePolicy(data, function (err, policy) {
            call.done(err, policy);
        });
    });

    server.onCall('deletePolicy', function (call) {
        call.cloud.deletePolicy(call.data.id, function (err, data) {
            call.done(err, data);
        });
    });

    server.onCall('updateUser', function (call) {
        var data = filterFields(call.data, updatableUserFields);

        call.cloud.updateUser(data, function (err, data) {
            call.done(err, data);
        });
    });

    server.onCall('createUser', function (call) {
        var data = {};
        accountFields.forEach(function (f) {
            data[f] = call.data[f] || null;
        });
        data.password = call.data.password;
        call.cloud.createUser(data, function (err, data) {
            call.done(err, data);
        });
    });

    server.onCall('deleteUser', function (call) {
        call.cloud.deleteUser(call.data.id, function (err, data) {
            call.done(err, data);
        });
    });

    server.onCall('changeUserPassword', function (call) {
        call.cloud.changeUserPassword(call.data, function (err, data) {
            call.done(err, data);
        });
    });

    server.onCall('updateAccount', function (call) {
        // update account using cloudapi
        var data = {};
        updatableAccountFields.forEach(function (f) {
            data[f] = call.data[f] || null;
        });

        if (call.req.session.subId) {
            data.id = call.req.session.subId;
            call.cloud.updateUser(data, function (userErr, userData) {
                if (userErr) {
                    return call.done(userErr);
                }
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
        return '/' + client.user + '/stor' + (old ? '' : '/.joyent') + '/portal/config.' +
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
                    setTimeout(function () {
                        readOldOrNewFile(call, client, callback)
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
        var configPath = getConfigPath(call, client);

        function checkResponse(call, error) {
            if (error) {
                call.req.log.error({error: error}, 'Cannot write user config');
            }
            call.done(null, !!error);
        }

        var putConfig = function (call, client) {
            return client.putFileContents(configPath, JSON.stringify(call.data), function (error) {

                if (error && error.statusCode === 404) {
                    client.mkdirp(configPath.substring(0, configPath.lastIndexOf('/')), function (err) {
                        if (err) {
                            checkResponse(call, err);
                        } else {
                            putConfig(call, client);
                        }
                    });
                } else {
                    checkResponse(call, error);
                }
            });
        };
        putConfig(call, client);
    });
};
