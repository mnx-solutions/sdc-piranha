'use strict';
var config = require('easy-config');
var vasync = require('vasync');
var util = require('util');

if (!config.features || config.features.rbac !== 'disabled') {
    module.exports = function execute(scope) {
        var server = scope.api('Server');
        var MantaClient = scope.api('MantaClient');

        var accountFields = ['id', 'login', 'email', 'companyName', 'firstName', 'lastName', 'address', 'postalCode', 'city', 'state', 'country', 'phone', 'created'];
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
            createmachine:         '/my/machines',
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
            getmachine:            '/my/machines/%s',
            renamemachine:         '/my/machines/%s',
            startmachine:          '/my/machines/%s',
            stopmachine:           '/my/machines/%s',
            deletemachine:         '/my/machines/%s',
            rebootmachine:         '/my/machines/%s',

            getmachinemetadata:    '/my/machines/%s',
            updatemachinemetadata: '/my/machines/%s',
            deletemachinemetadata: '/my/machines/%s',
            deleteallmachinemetadata: '/my/machines/%s',

            listmachinetags:       '/my/machines/%s',
            getmachinetag:         '/my/machines/%s',
            replacemachinetags:    '/my/machines/%s',
            deletemachinetag:      '/my/machines/%s',
            deletemachinetags:     '/my/machines/%s',

            listmachinefirewallrules: '/my/machines/%s',

            getnetwork:            '/my/networks/%s',

            enablefirewallrule:    '/my/fwrules/%s',
            disablefirewallrule:   '/my/fwrules/%s',
            deletefirewallrule:    '/my/fwrules/%s',
            updatefirewallrule:    '/my/fwrules/%s',
            getfirewallrule:       '/my/fwrules/%s',
            listfirewallrulemachines: '/my/fwrules/%s',

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

        var loadRoleTagData = function (call, roles, log, loadDataCallback) {
            if (!roles || roles.length === 0) {
                return;
            }
            var cloudapi = call.cloud;
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
                };


                Object.keys(datacenters).forEach(function (datacenter) {
                    funcs.push(function networks(callback) {
                        cloudapi.separate(datacenter).listNetworks(function (err, data) {
                            if (err) {
                                log.error(err);
                                data = [];
                            }
                            callback(null, separateResult(datacenter, data));
                        });
                    });
                    funcs.push(function machines(callback) {
                        cloudapi.separate(datacenter).listMachines(function (err, data) {
                            if (err) {
                                log.error(err);
                                data = [];
                            }
                            callback(null, separateResult(datacenter, data));
                        });
                    });
                    funcs.push(function images(callback) {
                        cloudapi.separate(datacenter).listImages(function (err, data) {
                            if (err) {
                                log.error(err);
                                data = [];
                            }
                            callback(null, separateResult(datacenter, data));
                        });
                    });
                    funcs.push(function firewallRules(callback) {
                        cloudapi.separate(datacenter).listFwRules(function (err, data) {
                            if (err) {
                                log.error(err);
                                data = [];
                            }
                            callback(null, separateResult(datacenter, data));
                        });
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
                                });
                            }
                        });

                        Object.keys(resultsHash.machines).forEach(function (datacenter) {
                            var networksCache = {};
                            resultsHash.networks[datacenter].forEach(function (network) {
                                networksCache[network.id] = true;
                            });
                            resultsHash.machines[datacenter].forEach(function (machine) {
                                machine.networks.forEach(function (network) {
                                    if (!networksCache[network]) {
                                        resultsHash.networks[datacenter].push({id: network});
                                    }
                                });
                            });
                        });
                        loadDataCallback(call, getArray(roles, true), log, users, networks, policies, machines, images, firewallRules);
                    }
                });
            });
        };


        var updateRoleTags = function (call, roles, log, users, networks, policies, machines, images, firewallRules) {
            roles = roles.filter(function (role) {
                return role.default_members && role.default_members.length > 0;
            });
            var cloudapi = call.cloud;
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
                                        case 'enablefirewallrule':
                                        case 'disablefirewallrule':
                                        case 'getfirewallrule':
                                        case 'updatefirewallrule':
                                        case 'deletefirewallrule':
                                        case 'listfirewallrulemachines':
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
                                        case 'getmachine':
                                        case 'renamemachine':
                                        case 'startmachine':
                                        case 'stopmachine':
                                        case 'deletemachine':
                                        case 'rebootmachine':

                                        case 'getmachinemetadata':
                                        case 'updatemachinemetadata':
                                        case 'deletemachinemetadata':
                                        case 'deleteallmachinemetadata':

                                        case 'listmachinetags':
                                        case 'getmachinetag':
                                        case 'replacemachinetags':
                                        case 'deletemachinetag':
                                        case 'deletemachinetags':

                                        case 'listmachinefirewallrules':
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
                                    });
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

        var pipeline = function (items, action, call, callback) {
            var pool = [];
            items.forEach(function (item) {
                pool.push(function (_, callback) {
                    call.cloud[action](item, callback);
                });
            });
            vasync.pipeline({'funcs': pool}, callback);
        };

        function createUserConfig(call, userData, callback) {
            var client = MantaClient.createClient(call);
            var configDir = '~~/stor/.joyent/portal/' + userData.id;
            var configPath = configDir + '/config.json';

            return client.mkdirp(configDir, function (error) {
                if (error) {
                    return callback(error);
                }
                return client.putFileContents(configPath, '{}', function (error) {
                    if (error) {
                        return callback(error);
                    }
                    return callback(null);
                });
            });
        }

        function removeUserConfig(call, userId, callback) {
            var client = MantaClient.createClient(call);
            var configDir = '~~/stor/.joyent/portal/' + userId;
            client.rmr(configDir, {recursive: true}, callback);
        }

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

        server.onCall('createUser', function (call) {
            var data = {};
            accountFields.forEach(function (f) {
                if (call.data[f]) {
                    data[f] = call.data[f];
                }
            });
            data.password = call.data.password;
            call.cloud.createUser(data, function (createErr, userData) {
                if (createErr) {
                    call.done(createErr);
                    return;
                }

                var searchUserInList = function (list, user) {
                    return list.some(function (userInList) {
                        return userInList.login === user.login;
                    });
                };

                (function checkUsersList() {
                    call.cloud.listUsers(function (listError, listData) {
                        if (listError) {
                            call.done(listError);
                        } else if (searchUserInList(listData, userData)) {
                            call.done(null, userData);
                            createUserConfig(call, userData, function (error) {
                                if (error) {
                                    call.req.log.error({error: error}, 'Failed create user config');
                                }
                            });
                        } else {
                            setTimeout(checkUsersList, 1000);
                        }
                    }, true);
                })();
            });
        });

        server.onCall('updateUser', function (call) {
            var data = filterFields(call.data, updatableUserFields);

            call.cloud.updateUser(data, function (err, userData) {
                call.done(err, userData);
            });
        });

        function capitalize(string) {
            return string.charAt(0).toUpperCase() + string.slice(1);
        }

        server.onCall('deleteUser', {
            verify: function (data) {
                return Array.isArray(data.ids) || typeof (data.id) === 'string';
            },
            handler: function (call) {
                var ids = call.data.ids || [call.data.id];
                vasync.forEachParallel({
                    inputs: ids,
                    func: function (id, callback) {
                        call.cloud.deleteUser(id, function (err) {
                            callback(err);
                            removeUserConfig(call, id, function (error) {
                                if (error && error.statusCode !== 404) {
                                    call.req.log.error({error: error}, 'Failed remove user config');
                                }
                            });
                        });
                    }
                }, function (errors) {
                    var result = null;
                    if (errors) {
                        result = errors;
                        if (Array.isArray(errors.ase_errors) && errors.ase_errors.length === 1) {
                            result.message = errors.ase_errors[0].message;
                        }
                        if (result && result.message) {
                            result.message = capitalize(result.message);
                        }
                    }
                    call.done(result);
                });
            }
        });

        server.onCall('changeUserPassword', function (call) {
            call.cloud.changeUserPassword(call.data, function (err, data) {
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

        server.onCall('listRoles', function (call) {
            call.cloud.listRoles(function (err, data) {
                call.done(err, data);
            });
        });

        server.onCall('getRole', function (call) {
            call.cloud.getRole(call.data.id, function (err, data) {
                call.done(err, data);
            });
        });

        var handleAdminRole = function (data) {
            if (data.name === 'administrator' && data.policies && data.policies.length === 0) {
                delete data.policies;
            }
        };

        server.onCall('createRole', function (call) {
            var data = filterFields(call.data, roleFields, true);

            handleAdminRole(data);

            call.cloud.createRole(data, function (err, roleData) {
                call.done(err, roleData);
                if (!err) {
                    loadRoleTagData(call, roleData, call.log, updateRoleTags);
                }
            });
        });

        server.onCall('updateRole', function (call) {
            var data = filterFields(call.data, updatableRoleFields);

            handleAdminRole(data);

            call.cloud.updateRole(data, function (err, roleData) {
                call.done(err, roleData);
                if (!err) {
                    loadRoleTagData(call, roleData, call.log, updateRoleTags);
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
                        loadRoleTagData(call, roles, call.log, updateRoleTags);
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

    };
}