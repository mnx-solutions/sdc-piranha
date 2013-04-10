'use strict';

var vasync = require('vasync');

module.exports = function (scope, callback) {
    var server = scope.api('Server');

    server.onCall('MachineList', function (call) {
        call.log.info('Handling machine list event');

        var cloud = call.cloud;
        var datacenters = cloud.listDatacenters();
        var keys = Object.keys(datacenters);
        var count = keys.length;

        keys.forEach(function (name) {
            cloud.setDatacenter(name);

            call.log.debug('List machines for datacenter %s', name);

            cloud.listMachines({'credentials': true}, function (err, machines) {
                var response = {
                    name: name,
                    status: 'pending',
                    machines: []
                };

                if (err) {
                    response.err = err;
                    response.status = 'error';

                    call.log.error('List machines failed for datacenter %s; err: %s', name, err.message);
                } else {
                    machines.forEach(function (machine) {
                        machine.datacenter = name;
                        machine.metadata.credentials = handleCredentials(machine);
                    });

                    response.status = 'complete';
                    response.machines = machines;

                    call.log.debug('List machines succeeded for datacenter %s', name);
                }

                call.update(null, response);
                if(--count === 0) {
                    call.done();
                }
            });
        });

    });

    /* listPackages */
    server.onCall('PackageList', function (call) {
        call.log.info('Handling list packages event');
        call.cloud.listPackages(call.done.bind(call));
    });

    /* listDatasets */
    server.onCall('DatasetList', function (call) {
        call.log.info('Handling list datasets event');
        call.cloud.listDatasets(call.done.bind(call));
    });

    /* listDatasets */
    server.onCall('DatacenterList', function (call) {
        call.log.info('Handling list datasets event');
        call.cloud.listDatacenters(call.done.bind(call));
    });


    /* listMachineTags */
    server.onCall('MachineTagsList', {
        verify: function (data) {
            return data && "string" === typeof data.uuid;
        },
        handler: function (call) {
            call.log.info('Handling machine tags list call, machine %s', call.data.uuid);
            call.cloud.listMachineTags(call.data.uuid, call.done.bind(call));
        }
    });

    /* listMachineTags */
    server.onCall('MachineTagsSave', {
        verify: function (data) {
            return data &&
                typeof data.uuid === 'string' &&
                typeof data.tags === 'object';
        },
        handler: function (call) {
            call.log.info('Handling machine tags save call, machine %s', call.data.uuid);

            var newTags = JSON.stringify(call.data.tags);
            var oldTags = null;

            call.cloud.replaceMachineTags(call.data.uuid, call.data.tags, function (err) {
                if(err) {
                    call.log.error(err);
                    call.done(err);
                    return;
                }
                var timer = setInterval(function () {
                    call.log.debug('Polling for machine %s tags to become %s', call.data.uuid, newTags);
                    call.cloud.listMachineTags(call.data.uuid, function (err, tags) {
                        if (!err) {
                            var json = JSON.stringify(tags);
                            if(json === newTags) {
                                call.log.debug('Machine %s tags changed successfully', call.data.uuid);
                                clearInterval(timer);
                                call.done(null, tags);
                            } else if(!oldTags) {
                                oldTags = json;
                            } else if(json !== oldTags) {
                                clearInterval(timer);
                                call.done(new Error('Other call changed tags'));
                            }
                        }
                    }, undefined, true);
                }, 1000);
            });
        }
    });

    /* GetMachine */
    server.onCall('MachineDetails', {
        verify: function (data) {
            return data && typeof data.uuid === 'string';
        },
        handler: function (call) {
            var machineId = call.data.uuid;
            call.log.info('Handling machine details call, machine %s', machineId);

            call.cloud.setDatacenter(call.data.datacenter);
            call.cloud.getMachine(machineId, call.done.bind(call));
        }
    });

    function pollForMachineState(client, call, machineId, state) {
        var timer = setInterval(function () {
            call.log.debug('Polling for machine %s to become %s', machineId, state);
            client.getMachine(machineId, function (err, machine) {
                if (!err) {
                    if (state === machine.state) {
                        call.log.debug('Machine %s state is %s as expected, returing call', machineId, state);
                        call.done(null, machine);
                        clearInterval(timer);
                    } else {
                        call.log.trace('Machine %s state is %s, waiting for %s', machineId, machine.state, state);
                        call.step = {state: machine.state};
                    }
                }
            });
        }, 5000);
    }

    function pollForMachinePackageChange(client, call, sdcpackage) {
        var timer = setInterval(function () {
            var machineId = typeof call.data === 'object' ? call.data.uuid : call.data;

            call.log.debug('Polling for machine %s to resize to %s', machineId, sdcpackage);
            client.getMachine(machineId, function (err, machine) {
                if (!err) {
                    if (sdcpackage === machine.package) {
                        call.log.debug('Machine %s resized to %s as expected, returing call', machineId, sdcpackage);
                        call.done(null, machine);
                        clearInterval(timer);
                    } else {
                        call.log.debug('Machine %s memory size is %s, waiting for %s', machineId, machine.memory, sdcpackage);
                        call.step = { state: 'resizing' };
                    }
                } else {
                    call.log.error(err);
                }
            });
        }, 1000);
    }

    function changeState(func, logVerb, endstate, opts) {
        if(!opts) {
            opts = {};
        }
        if(!opts.verify) {
            opts.verify = function(data) {
                return typeof data === 'object' &&
                    data.hasOwnProperty('uuid') &&
                    data.hasOwnProperty('datacenter');
            };
        }
        if(!opts.handler) {
            opts.handler = function (call) {

                var machineId = call.data.uuid;
                call.log.debug(logVerb + ' machine %s', machineId);

                call.cloud.setDatacenter(call.data.datacenter);
                call.cloud[func](machineId, function (err) {
                    if (!err) {
                        pollForMachineState(call.cloud, call, machineId, endstate);
                    } else {
                        call.log.error(err);
                        call.done(err);
                    }
                });
            };
        }
        return opts;
    }

    function handleCredentials(machine) {
        var systemsToLogins = {
            "mysql" : ["MySQL", "root"],
            "pgsql" : ["PostgreSQL", "postgres"],
            "virtualmin" : ["Virtualmin", "admin"]
        }
        var credentials = [];
        if (machine.metadata && machine.metadata.credentials) {
            for (var username in machine.metadata.credentials) {
                if (systemsToLogins[username]) {
                    var system = systemsToLogins[username][0];
                    var login = systemsToLogins[username][1];
                } else {
                    var system = "Operating System";
                    var login = username;
                }

                credentials.push(
                    {
                        "system" : system,
                        "username" : login.split('_')[0],
                        "password" : machine.metadata.credentials[username]
                    }
                );
            }
        }
        return credentials;
    }

    /* GetMachine */
    server.onCall('MachineStart', changeState('startMachine','Starting', 'running'));

    /* GetMachine */
    server.onCall('MachineStop', changeState('stopMachine','Stopping', 'stopped'));

    /* GetMachine */
    server.onCall('MachineDelete', changeState('deleteMachine','Deleting', 'deleted'));

    server.onCall('MachineReboot', changeState('rebootMachine','Rebooting', 'running'));

    /* ResizeMachine */
    server.onCall('MachineResize', {
        verify: function (data) {
            return typeof data === 'object' &&
                data.hasOwnProperty('uuid') &&
                data.hasOwnProperty('datacenter') &&
                data.hasOwnProperty('sdcpackage');
        },
        handler: function (call) {
            var machineId = call.data.uuid;
            var options = {
                package: call.data.sdcpackage
            };

            call.log.info('Resizing machine %s', machineId);

            call.cloud.setDatacenter(call.data.datacenter);
            call.cloud.resizeMachine(machineId, options, function (err) {
                if (!err) {
                    pollForMachinePackageChange(call.cloud, call, call.data.sdcpackage);
                } else {
                    call.log.error(err);
                    call.done(err);
                }
            });
        }
    });

    /* ResizeMachine */
    server.onCall('MachineCreate', {
        verify: function (data) {
            return typeof data === 'object' &&
                data.sdcpackage.hasOwnProperty('name') &&
                data.hasOwnProperty('dataset') &&
                data.hasOwnProperty('datacenter') &&
                data.dataset.hasOwnProperty('id');
        },
        handler: function (call) {

            var options = {
                name: call.data.name,
                package: call.data.sdcpackage.name,
                dataset: call.data.dataset.id
            };
            console.log(call.data);
            call.log.info('Creating machine %s', call.data.name);
            call.getImmediate(false);

            call.cloud.setDatacenter(call.data.datacenter);
            call.cloud.createMachine(options, function (err, machine) {
                if (!err) {
                    call.immediate(null, {machine: machine});
                    pollForMachineState(call.cloud, call, machine.id, 'running');
                } else {
                    call.log.error(err);
                    call.immediate(err);
                }
            });
        }
    });

    setImmediate(callback);
}