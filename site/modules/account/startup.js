'use strict';

var config = require('easy-config');
var metadata = require('./lib/metadata');
var ursa = require('ursa');
var vasync = require('vasync');
var util = require('util');

module.exports = function execute(scope) {
    var server = scope.api('Server');
    var TFA = scope.api('TFA');
    var Billing = scope.api('Billing');
    var SignupProgress = scope.api('SignupProgress');
    var Marketo = scope.api('Marketo');
    var MantaClient = scope.api('MantaClient');

    var accountFields = ['id', 'login', 'email', 'companyName', 'firstName', 'lastName', 'address', 'postalCode', 'city', 'state', 'country', 'phone', 'created'];
    var updatableAccountFields = ['email', 'companyName', 'firstName', 'lastName', 'address', 'postalCode', 'city', 'state', 'country', 'phone'];
    var updatableUserFields = ['id', 'login', 'email', 'companyName', 'firstName', 'lastName', 'address', 'postalCode', 'city', 'state', 'country', 'phone'];
    var roleFields = ['name', 'members', 'default_members', 'name', 'policies'];
    var updatableRoleFields = ['id', 'name', 'members', 'default_members', 'policies'];
    var policyFields = ['name', 'rules', 'description'];
    var updatablePolicyFields = ['id', 'name', 'rules', 'description'];

    var filterFields = function (callData, filter, skipIfEmpty) {
        var data = {};
        filter.forEach(function (f) {
            if (!skipIfEmpty || (typeof (callData[f]) === 'string' || (callData[f] && callData[f].length >= 0))) {
                    data[f] = callData[f];
            }
        });
        return data;
    };

    // Account actions->resource
    var SIMPLE_RESOURCES = {
        getaccount:            '/my/',
        listmachines:          '/my/machines',
        listkeys:              '/my/keys',
        createkey:             '/my/keys',
        listusers:             '/my/users',
        listimages:            '/my/images',
        listroles:             '/my/roles',
        listpolicies:          '/my/policies',
        listdatacenters:       '/my/datacenters',
        listnetworks:          '/my/networks',
        listpackages:          '/my/packages',
        listfirewallrules:     '/my/fwrules',
        createinstrumentation: '/my/analytics/instrumentations',
        describeanalytics:     '/my/analytics'
    };

    // SubUser actions->resource
    var CUSTOM_RESOURCES = {
        startmachine:          '/my/machines/%s',
        stopmachine:           '/my/machines/%s',
        deletemachine:         '/my/machines/%s',
        rebootmachine:         '/my/machines/%s',

        deletemachinetags:     '/my/machines/%s/tags',
        replacemachinetags:    '/my/machines/%s/tags',
        addmachinemetadata:    '/my/machines/%s/metadata',
        listmachinemetadata:   '/my/machines/%s/metadata',

        getnetwork:            '/my/networks/%s',

        deletefirewallrule:    '/my/fwrules/%s',
        updatefirewallrule:    '/my/fwrules/%s',
        getfirewallrule:       '/my/fwrules/%s',

        getimage:              '/my/images/%s',
        deleteimage:           '/my/images/%s',
        updateimage:           '/my/images/%s',

        listuserkeys:          '/my/users/%s/keys',
        createuserkey:         '/my/users/%s/keys',
        uploaduserkey:         '/my/users/%s/keys',
        getuserkey:            '/my/users/%s/keys/%s',
        deleteuserkey:         '/my/users/%s/keys/%s',

        getuser:               '/my/users/%s',
        updateuser:            '/my/users/%s'
    };

    var SIMPLE_ACTIONS = Object.keys(SIMPLE_RESOURCES);
    var CUSTOM_ACTIONS = Object.keys(CUSTOM_RESOURCES);

    var getArray = function (data, force) {
        return Array.isArray(data) ? data : (force ? [data] : []);
    };

    var loadRoleTagData = function (cloudapi, roles, log, loadDataCallback) {
        if (!roles || !roles.length === 0) {
            return;
        }
        var funcs = [
            function users(callback) {
                cloudapi.listUsers(callback);
            },
            function policies(callback) {
                cloudapi.listPolicies(callback);
            }
        ];
        cloudapi.listDatacenters(function (err, datacenters) {
            if (err) {
                log.error(err);
                return;
            }
            var separateResult = function (datacenter, data) {
                var result = {};
                result[datacenter] = data;
                return result;
            }
            Object.keys(datacenters).forEach(function (datacenter) {
                funcs.push(function networks(callback) {
                    cloudapi.separate(datacenter).listNetworks(function (err, data) {
                            callback(err, separateResult(datacenter, data));
                        }
                    );
                });
                funcs.push(function machines(callback) {
                    cloudapi.separate(datacenter).listMachines(function (err, data) {
                        callback(err, separateResult(datacenter, data));
                    });
                });
                funcs.push(function images(callback) {
                    cloudapi.separate(datacenter).listImages(
                        function (err, data) {
                            callback(err, separateResult(datacenter, data));
                        }
                    );
                });
                funcs.push(function firewallRules(callback) {
                    cloudapi.separate(datacenter).listFwRules(function (err, data) {
                            callback(err, separateResult(datacenter, data));
                        }
                    );
                });
            });

            vasync.parallel({
                'funcs': funcs
            }, function (err, results) {
                if (err) {
                    log.error(err);
                } else if (results && results.nerrors === 0) {
                    var users = [];
                    var policies = [];
                    var networks = {};
                    var images = {};
                    var machines = {};
                    var firewallRules = {};
                    var resultsHash = {
                        'users': users,
                        'policies': policies,
                        'machines': machines,
                        'networks': networks,
                        'images': images,
                        'firewallRules': firewallRules
                    };
                    results.operations.forEach(function (operation) {
                        var funcname = operation.funcname;
                        if (Array.isArray(operation.result)) {
                            getArray(operation.result).forEach(function (item) {
                                resultsHash[funcname].push(item);
                            });
                        } else {
                            Object.keys(operation.result).forEach(function (datacenter) {
                                resultsHash[funcname][datacenter] = resultsHash[funcname][datacenter] || [];
                                resultsHash[funcname][datacenter] = operation.result[datacenter];
                            })
                        }
                    });
                    loadDataCallback(cloudapi, getArray(roles, true), log, users, networks, policies, machines, images, firewallRules);
                }
            })
        });
    };


    var updateRoleTags = function (cloudapi, roles, log, users, networks, policies, machines, images, firewallRules) {
        roles = roles.filter(function (role) {
            return role.default_members && role.default_members.length > 0;
        });

        var pushResourceRole = function (resourceRole, resource, role, datacenter) {
            datacenter = datacenter || 'all';
            if (!resourceRole[datacenter]) {
                resourceRole[datacenter] = {};
            }

            resourceRole[datacenter][resource] = resourceRole[datacenter][resource] || [];
            if (resourceRole[datacenter][resource].indexOf(role.name) === -1) {
                resourceRole[datacenter][resource].push(role.name);
            }
        };

        var setRoleTags = function (datacenter, resource, roles) {
            var cloudByDatacenter = !datacenter || datacenter === 'all' ? cloudapi : cloudapi.separate(datacenter);
            cloudByDatacenter.getRoleTags(resource, function (err, roleNames) {
                roleNames = roleNames || [];
                var newRoles = roles.filter(function (roleName) {
                    return roleNames.indexOf(roleName) === -1;
                });
                if (newRoles.length > 0) {
                    roleNames = roleNames.concat(newRoles);
                    cloudByDatacenter.setRoleTags(resource, roleNames, function (err) {
                        if (err) {
                            log.error({error: err, roleNames: roleNames, resource: resource}, 'Failed to setRoleTags');
                        }
                    });
                }
            });
        };
        var resourceRole = {};
        var fetchUserKeysResourceRole = {};
        roles.forEach(function (role) {
            var defaultMembers = {};
            role.default_members.forEach(function (member) {
                defaultMembers[member] = {};
            });


            var policiesByRole = policies.filter(function (policy) {
                return role.policies.indexOf(policy.name) !== -1;
            });

            users.forEach(function (user) {
                if (defaultMembers[user.login]) {
                    defaultMembers[user.login] = user;
                }
            });


            policiesByRole.forEach(function (policy) {
                policy.rules.forEach(function (rule) {
                    SIMPLE_ACTIONS.forEach(function (command) {
                        if (rule.indexOf(command) !== -1) {
                            pushResourceRole(resourceRole, SIMPLE_RESOURCES[command], role);
                        }
                    });

                    CUSTOM_ACTIONS.forEach(function (command) {
                        if (rule.indexOf(command) !== -1) {
                            role.default_members.forEach(function (member) {
                                var resources = [];
                                var resourcesByDatacenter = {};
                                var collectResourcesByDatacenters = function (data, command) {
                                    Object.keys(data).forEach(function (datacenter) {
                                        resourcesByDatacenter[datacenter] = resourcesByDatacenter[datacenter] || [];
                                        data[datacenter].forEach(function (item) {
                                            resourcesByDatacenter[datacenter].push(util.format(CUSTOM_RESOURCES[command], item.id));
                                        });
                                    });
                                };

                                switch (command) {
                                    case 'getimage':
                                    case 'deleteimage':
                                    case 'updateimage':
                                        collectResourcesByDatacenters(images, command);
                                        break;
                                    case 'updatefirewallrule':
                                    case 'deletefirewallrule':
                                        collectResourcesByDatacenters(firewallRules, command);
                                        break;
                                    case 'uploaduserkey':
                                    case 'deleteuserkey':
                                    case 'getuserkey':
                                        fetchUserKeysResourceRole[defaultMembers[member].id] = fetchUserKeysResourceRole[defaultMembers[member].id] || [];
                                        if (fetchUserKeysResourceRole[defaultMembers[member].id].indexOf(role.name) === -1) {
                                            fetchUserKeysResourceRole[defaultMembers[member].id].push(role.name);
                                        }
                                        break;
                                    case 'getnetwork':
                                        collectResourcesByDatacenters(networks, command);
                                        break;
                                    case 'startmachine':
                                    case 'stopmachine':
                                    case 'deletemachine':
                                    case 'rebootmachine':
                                    case 'deletemachinetags':
                                    case 'enablemachinefirewall':
                                    case 'replacemachinetags':
                                    case 'addmachinemetadata':
                                    case 'listmachinemetadata':
                                        collectResourcesByDatacenters(machines, command);
                                        break;

                                    default :
                                        resources.push(util.format(CUSTOM_RESOURCES[command], defaultMembers[member].id));
                                        break;
                                }
                                resources.forEach(function (resource) {
                                    pushResourceRole(resourceRole, resource, role);
                                });
                                Object.keys(resourcesByDatacenter).forEach(function (dataceter) {
                                    resourcesByDatacenter[dataceter].forEach(function (resource) {
                                        pushResourceRole(resourceRole, resource, role, dataceter);
                                    });
                                })
                            });
                        }
                    });
                });
            });
        });

        var datacenters = Object.keys(resourceRole);
        datacenters.forEach(function (datacenter) {
            var roleResources = Object.keys(resourceRole[datacenter]);
            roleResources.forEach(function (resource) {
                setRoleTags(datacenter, resource, resourceRole[datacenter][resource]);
            });
        });
        var userKeysResourceRole = Object.keys(fetchUserKeysResourceRole);
        var poolTasks = [];
        userKeysResourceRole.forEach(function (userId) {
            poolTasks.push(function (callback) {
                cloudapi.listUserKeys(userId, function (err, data) {
                    data = {userId: userId, roles: fetchUserKeysResourceRole[userId], data: data};
                    callback(err, data);
                });
            });
        });
        vasync.parallel({
            'funcs': poolTasks
        }, function (err, results) {
            if (err) {
                log.error(err);
            }
            results.successes.forEach(function (result) {
                (result.data || []).forEach(function (userKey) {
                    var resource = util.format(CUSTOM_RESOURCES['getuserkey'], result.userId, userKey.fingerprint);
                    setRoleTags('all', resource, result.roles);
                });
            });
        });
    };

    var getBillingAndComplete = function (call, response) {
        Billing.isActive(call.req.session.userId, function (billingError, isActive) {
            call.req.session.provisionEnabled = response.provisionEnabled = isActive;
            call.req.session.save();
            call.done(billingError, response);
        });
    };

    var pipeline = function (items, action, call, callback) {
        var pool = [];
        items.forEach(function (item) {
            pool.push(function (_, callback) {
                call.cloud[action](item, callback);
            });
        });
        vasync.pipeline({'funcs': pool}, callback);
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
            });
        }
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

    server.onCall('listUserKeys', function (call) {
        call.cloud.listUserKeys(call.data.id, function (err, data) {
            call.done(err, data);
        }, !!call.data.noCache);
    });

    server.onCall('getUserKey', function (call) {
        call.cloud.getUserKey(call.data.id, call.data.key, function (err, data) {
            call.done(err, data);
        }, !!call.data.noCache);
    });

    server.onCall('uploadUserKey', function (call) {
        call.cloud.uploadUserKey(call.data.id, {name: call.data.options.name, key: call.data.options.key}, function (err, data) {
            call.done(err, data);
        });
    });

    server.onCall('deleteUserKey', function (call) {
        call.cloud.deleteUserKey(call.data.id, call.data.key, function (err, data) {
            call.done(err, data);
        });
    });

    server.onCall('createRole', function (call) {
        var data = filterFields(call.data, roleFields, true);

        call.cloud.createRole(data, function (err, roleData) {
            call.done(err, roleData);
            if (!err) {
                loadRoleTagData(call.cloud, roleData, call.log, updateRoleTags);
            }
        });
    });

    server.onCall('updateRole', function (call) {
        var data = filterFields(call.data, updatableRoleFields);

        call.cloud.updateRole(data, function (err, roleData) {
            call.done(err, roleData);
            if (!err) {
                loadRoleTagData(call.cloud, roleData, call.log, updateRoleTags);
            }
        });
    });


    server.onCall('deleteRole', function (call) {
        if (call.data.ids) {
            pipeline(call.data.ids, 'deleteRole', call, function (err, data) {
                call.done(err, data);
            });
        } else {
            call.cloud.deleteRole(call.data.id, function (err, data) {
                call.done(err, data);
            });
        }
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
        call.cloud.createPolicy(data, function (err, policyData) {
            call.done(err, policyData);
        });
    });

    server.onCall('updatePolicy', function (call) {
        var data = filterFields(call.data, updatablePolicyFields, true);
        call.cloud.updatePolicy(data, function (err, policy) {
            call.done(err, policy);
            if (!err) {
                call.cloud.listRoles(function (err, roles) {
                    roles = Array.isArray(roles) ? roles : [roles];
                    roles = roles.filter(function (role) {
                        return role.policies.indexOf(policy.name) !== -1;
                    });
                    loadRoleTagData(call.cloud, roles, call.log, updateRoleTags);
                });
            }
        });
    });

    server.onCall('deletePolicy', function (call) {
        if (call.data.ids) {
            pipeline(call.data.ids, 'deletePolicy', call, function (err, data) {
                call.done(err, data);
            });
        } else {
            call.cloud.deletePolicy(call.data.id, function (err, data) {
                call.done(err, data);
            });
        }
    });

    server.onCall('updateUser', function (call) {
        var data = filterFields(call.data, updatableUserFields);

        call.cloud.updateUser(data, function (err, userData) {
            call.done(err, userData);
        });
    });

    server.onCall('createUser', function (call) {
        var data = {};
        accountFields.forEach(function (f) {
            data[f] = call.data[f] || null;
        });
        data.password = call.data.password;
        call.cloud.createUser(data, function (err, userData) {
            call.done(err, userData);
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
        var configPath = getConfigPath(call, client);

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
