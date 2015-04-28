'use strict';

var config = require('easy-config');
var vasync = require('vasync');

function deleteSubuser(call, subId, name, deleteCallback) {
    if (!subId || !name) {
        return deleteCallback();
    }
    function deleteRolePolicy(action, rolePolicyList, callback) {
        var rolePolicy = rolePolicyList.find(function (item) { return item.name === name; });
        if (rolePolicy) {
            call.cloud[action](rolePolicy.id, function (err) {
                callback(err, null);
            });
        } else {
            callback(null, null);
        }
    }
    vasync.waterfall([
        function (callback) {
            call.cloud.listUserKeys(subId, function (listErr, keys) {
                callback(listErr, keys);
            });
        },
        function (keys, callback) {
            vasync.forEachPipeline({
                inputs: keys,
                func: function (key, pipeCallback) {
                    call.cloud.deleteUserKey(subId, key.fingerprint, pipeCallback);
                }
            }, callback);
        },
        function (_, callback) {
            call.cloud.listRoles(function (listErr, roles) {
                callback(listErr, roles);
            });
        },
        function (roles, callback) {
            deleteRolePolicy('deleteRole', roles, callback);
        },
        function (_, callback) {
            call.cloud.listPolicies(function (listErr, policies) {
                callback(listErr, policies);
            });
        },
        function (policies, callback) {
            deleteRolePolicy('deletePolicy', policies, callback);
        },
        function (_, callback) {
            call.cloud.deleteUser(subId, callback);
        }
    ], deleteCallback);
};

function setupSubuser(call, keyPair, subuserLogin, subuserObjName, listRules, setupCallback) {
    var user;
    vasync.waterfall([
        function (callback) {
            call.cloud.getAccount(function (accountErr, acccount) {
                callback(accountErr, acccount);
            });
        },
        function (account, callback) {
            var emailParts = account.email.split('@');
            emailParts[0] += '+' + subuserLogin;
            var userData = {
                lastName: subuserLogin,
                email: emailParts.join('@'),
                login: subuserLogin,
                password: (Math.random().toString(36) + 'ABC123').substr(2)
            };
            call.cloud.createUser(userData, callback);
        },
        function (newUser, callback) {
            user = newUser;
            call.cloud.createPolicy({
                name: subuserObjName,
                rules: listRules
            }, function () {
                callback();
            });
        },
        function (callback) {
            call.cloud.createRole({
                name: subuserObjName,
                policies: [subuserObjName],
                members: [user.login],
                'default_members': [user.login]
            }, function () {
                callback();
            });
        },
        function (callback) {
            call.cloud.uploadUserKey(user.id, {
                name: subuserObjName,
                key: keyPair.publicKey
            }, callback);
        },
        function (_, callback) {
            keyPoller(call, user.id, true, subuserObjName, function (error) {
                callback(error);
            })();
        }
    ], setupCallback);
};

function setupManta(client, call, subuserObjName, path, setupCallback) {
    vasync.waterfall([
        function (callback) {
            var waitingTime = Date.now() + 5 * 60 * 1000;
            var trySettingRoleTag = function (cb) {
                client.setRoleTags(path, [subuserObjName], false, function () {
                    client.getRoleTags(path, function (getErr, roles) {
                        if (roles.length === 1) {
                            cb(null);
                        } else if (Date.now() > waitingTime) {
                            cb('Cannot set role tags for ' + subuserObjName + ' folder');
                        } else {
                            trySettingRoleTag(cb);
                        }
                    });
                });
            };
            trySettingRoleTag(callback);
        },
        function (callback) {
            client.setRoleTags(path, [subuserObjName], true, function (setErr) {
                callback(setErr);
            });
        }
    ], setupCallback);
};

function keyPoller(call, subId, keyExists, subuserObjName, callback) {
    var start = new Date();
    return function (error) {
        if (error) {
            return callback(error);
        }

        function retry() {
            if (new Date() - start > config.polling.sshCreateKeyTimeout) {
                return callback(new Error('Poller error: SSH ' + (keyExists ? 'create' : 'delete') + ' key timeout'));
            }
            setTimeout(function () {
                keyPoller(call, subId, keyExists, callback);
            }, config.polling.sshCreateKey);
        }

        function isUserKeyExists(keys) {
            return keys.some(function (key) {
                return key.name === subuserObjName;
            });
        }

        call.cloud.listUserKeys(subId, function (error, keys) {
            if (!error && Array.isArray(keys) && isUserKeyExists(keys) === keyExists) {
                return callback();
            }
            retry();
        }, true);
    };
};

function setupSubuserForManta(call, client, options, callback) {
    var subuserLogin = options.subuserLogin;
    var subuserObjName = options.subuserObjName;
    var path = options.path;
    var keyPair = options.keyPair;
    call.cloud.listUsers(function (listErr, users) {
        if (listErr) {
            return callback(listErr);
        }

        var subuser = users.find(function (user) {
            return user.login === subuserLogin;
        });

        function setupSubuserAndManta() {
            setupSubuser(call, keyPair, subuserLogin, subuserObjName, options.listRules, function (err) {
                if (err) {
                    return callback(err);
                }
                setupManta(client, call, subuserObjName, path, callback);
            });
        }

        if (subuser) {
            var isFirstCheck = true;
            var checkKey = function () {
                call.cloud.listUserKeys(subuser.id, function (listErr, keys) {
                    if (listErr) {
                        return callback(listErr);
                    }
                    var key = keys.find(function (key) {
                        return key.name === subuserObjName && keyPair.fingerprint === key.fingerprint;
                    });
                    if (key) {
                        setupManta(client, call, subuserObjName, path, callback);
                    } else {
                        if (isFirstCheck) {
                            isFirstCheck = false;
                            setTimeout(checkKey, 10000);
                            return;
                        }
                        deleteSubuser(call, subuser.id, subuserObjName, function (deleteRegErr) {
                            if (deleteRegErr) {
                                return callback(deleteRegErr);
                            }
                            setupSubuserAndManta();
                        });
                    }
                });
            };
            checkKey();
        } else {
            setupSubuserAndManta();
        }
    });
};

function setMetadata(metadata, keyPair, loginName, accountName, url) {
    metadata['private-key'] = keyPair.privateKey;
    metadata['public-key'] = keyPair.publicKey;
    metadata['manta-account'] = accountName;
    metadata['manta-subuser'] = loginName;
    metadata['manta-url'] = url;
    return metadata;
}

exports.setupSubuserForManta = setupSubuserForManta;
exports.setMetadata = setMetadata;