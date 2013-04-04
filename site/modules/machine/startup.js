'use strict';

var vasync = require('vasync');

module.exports = function (scope, callback) {
    var cloud = scope.get('cloud');
    var server = scope.api('Server');

    server.onCall('MachineList', function (call) {
        call.log.info('Handling machine list event');
        var datacenters = {};

        vasync.pipeline({
            'funcs': [
                function (args, next) {
                    call.log.debug('List datacenters');
                    cloud.listDatacenters(function (err, dcs) {
                        if (err) {
                            call.log.error(err);
                            next(err);
                            return;
                        }

                        call.log.debug('Datacenters retrieved %o', dcs);

                        Object.keys(dcs).forEach(function (name, index) {
                            datacenters[name] = dcs[name];
                        });

                        next();
                    });
                },

                function (args, next) {
                    var keys = Object.keys(datacenters);
                    var count = keys.length;

                    keys.forEach(function (name, index) {
                        var client = cloud.proxy({ datacenter: name });
                        call.log.debug('List machines for datacenter %s', name);

                        client.listMachines(function (err, machines) {
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

                }
            ]
        }, function (err, results) {
        });
    });

    /* listPackages */
    server.onCall('PackageList', function (call) {
        call.log.info('Handling list packages event');

        var client = cloud.proxy();
        client.listPackages(call.done.bind(call));
    });

    /* listDatasets */
    server.onCall('DatasetList', function (call) {
        call.log.info('Handling list datasets event');

        var client = cloud.proxy();
        client.listDatasets(call.done.bind(call));
    });

    /* listDatasets */
    server.onCall('DatacenterList', function (call) {
        call.log.info('Handling list datasets event');

        cloud.listDatacenters(call.done.bind(call));
    });


    /* listMachineTags */
    server.onCall('MachineTagsList', {
        verify: function (data) {
            return data && "string" === typeof data.uuid;
        },
        handler: function (call) {
            call.log.info('Handling machine tags list call, machine %s', call.data.uuid);

            var client = cloud.proxy();
            client.listMachineTags(call.data.uuid, call.done.bind(call));
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

            var client = cloud.proxy();
            client.deleteMachineTags(call.data.uuid, function (err) {
                if(err) {
                    call.log.error(err);
                    call.done(err);
                    return;
                }

                client.addMachineTags(call.data.uuid, call.data.tags, function(err) {
                    call.done(err, call.data.tags); // Return saved tags
                });
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

            var client = cloud.proxy(call.data);
            
            client.getMachine(machineId, call.done.bind(call));
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

            call.log.debug('Polling for machine %s to resize to %s', machineId, sdcpackage.memory);
            client.getMachine(machineId, function (err, machine) {
                if (!err) {
                    if (sdcpackage.memory === machine.memory) {
                        call.log.debug('Machine %s resized to %s as expected, returing call', machineId, sdcpackage.memory);
                        call.done(null, machine);
                        clearInterval(timer);
                    } else {
                        call.log.debug('Machine %s memory size is %s, waiting for %s', machineId, machine.memory, sdcpackage.memory);
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

                var client = cloud.proxy(call.data);
                client[func](machineId, function (err) {
                    if (!err) {
                        pollForMachineState(client, call, machineId, endstate);
                    } else {
                        call.log.error(err);
                        call.done(err);
                    }
                });
            };
        }
        return opts;
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
                data.hasOwnProperty('sdcpackage') &&
                data.sdcpackage.hasOwnProperty('name');
        },
        handler: function (call) {
            var machineId = call.data.uuid;
            var options = {
                package: call.data.sdcpackage.name
            };

            call.log.info('Resizing machine %s', machineId);

            var client = cloud.proxy(call.data);
            client.resizeMachine(machineId, options, function (err) {
                if (!err) {
                    pollForMachinePackageChange(client, call, call.data.sdcpackage);
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
                data.dataset.hasOwnProperty('urn');
        },
        handler: function (call) {
            var options = {
                name: call.data.name,
                package: call.data.sdcpackage.name,
                dataset: call.data.dataset.id
            };

            call.log.info('Creating machine %s', call.data.name);
            call.getImmediate(false);

            var client = cloud.proxy(call.data);
            client.createMachine(options, function (err, machine) {
                if (!err) {
                    call.immediate(null, {machine: machine});
                    pollForMachineState(client, call, machine.id, 'running');
                } else {
                    call.log.error(err);
                    call.immediate(err);
                }
            });
        }
    });

    setImmediate(callback);
}