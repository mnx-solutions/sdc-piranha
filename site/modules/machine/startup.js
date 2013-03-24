'use strict';

var smartdc = require('smartdc');
var vasync = require('vasync');

module.exports = function (scope, callback) {
    var cloud = scope.get('cloud');
    var server = scope.api('Server');

    server.onCall('MachineList', function (call) {
        call.log.debug('Handling machine list event');
        var datacenters = {};

        vasync.pipeline({
            'funcs': [
                function (args, next) {
                    cloud.listDatacenters(function (err, dcs) {
                        if (err) {
                            next(err);
                            return;
                        }

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
                        client.listMachines(function (err, machines) {
                            var response = {
                                name: name,
                                status: 'pending',
                                machines: []
                            };

                            if (err) {
                                response.err = err;
                                response.status = 'error';
                            } else {
                                machines.forEach(function (machine) {
                                    machine.datacenter = name;
                                });

                                response.status = 'complete';
                                response.machines = machines;
                            }

                            call.progress = response;

                            if (--count === 0) {
                                call.done(null, response);
                            } else {
                                call.result = response;
                            }
                        });
                    });

                }
            ]
        }, function (err, results) {
            if (err) {
                //call.done(err);
            }
        });
    });

    /* listPackages */
    server.onCall('PackageList', function (call) {
        call.log.debug('Handling list packages event');

        var client = cloud.proxy();
        client.listPackages(function (err, packages) {
            if (!err) {
                call.done(null, packages);
            } else {
                call.done(err, packages);
            }
        });
    });

    /* listDatasets */
    server.onCall('DatasetList', function (call) {
        call.log.debug('Handling list datasets event');

        var client = cloud.proxy();
        client.listDatasets(function (err, datasets) {
            if (!err) {
                call.done(null, datasets);
            } else {
                call.done(err, datasets);
            }
        });
    });

    /* listDatasets */
    server.onCall('DatacenterList', function (call) {
        call.log.debug('Handling list datasets event');

        cloud.listDatacenters(function (err, datacenters) {
            if (!err) {
                call.done(null, datacenters);
            } else {
                call.done(err, datacenters);
            }
        });
    });


    /* listMachineTags */
    server.onCall('MachineTags', {
        verify: function (data) {
            return typeof(data) === 'string';
        },

        handler: function (call) {
            call.log.debug('Handling machine tags call');

            var client = cloud.proxy();
            client.listMachineTags(call.data, function (err, machine) {
                if (!err) {
                    call.done(null, machine);
                } else {
                    call.done(err, machine);
                }
            });
        }
    });

    /* GetMachine */
    server.onCall('MachineDetails', {
        verify: function (data) {
            return typeof(data) === 'string';
        },

        handler: function (call) {
            var machineId = call.data.machineId;
            call.log.debug('Handling machine details call');

            var client = cloud.proxy(call.data);
            client.getMachine(machineId, function (err, machine) {
                if (!err) {
                    call.done(null, machine);
                } else {
                    call.done(err, machine);
                }
            });
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
                        call.status = {state: machine.state};
                    }
                }
            });
        }, 5000);
    }

    function pollForMachinePackageChange(client, call, sdcpackage) {
        var timer = setInterval(function () {
            var machineId = typeof call.data === 'object' ? call.data.machineId : call.data;

            call.log.debug('Polling for machine %s to resize to %s', machineId, sdcpackage.memory);
            client.getMachine(machineId, function (err, machine) {
                if (!err) {
                    if (sdcpackage.memory === machine.memory) {
                        call.log.debug('Machine %s resized to %s as expected, returing call', machineId, sdcpackage.memory);
                        call.done(null, machine);
                        clearInterval(timer);
                    } else {
                        call.log.debug('Machine %s memory size is %s, waiting for %s', machineId, machine.memory, sdcpackage.memory);
                        call.status = { state: 'resizing' };
                    }
                }
            });
        }, 1000);
    }

    /* GetMachine */
    server.onCall('MachineStart', {
        verify: function (data) {
            return typeof(data) === 'object' &&
                data.hasOwnProperty('machineId') &&
                data.hasOwnProperty('datacenter');
        },

        handler: function (call) {
            var machineId = call.data.machineId;
            call.log.debug('Starting machine %s', machineId);

            var client = cloud.proxy(call.data);
            client.startMachine(machineId, function (err) {
                if (!err) {
                    pollForMachineState(client, call, machineId, 'running');
                } else {
                    call.done(err);
                }
            });
        }
    });

    /* GetMachine */
    server.onCall('MachineStop', {
        verify: function (data) {
            return typeof(data) === 'object' &&
                data.hasOwnProperty('machineId') &&
                data.hasOwnProperty('datacenter');
        },

        handler: function (call) {
            var machineId = call.data.machineId;
            call.log.debug('Stopping machine %s', machineId);

            var client = cloud.proxy(call.data);
            client.stopMachine(machineId, function (err) {
                if (!err) {
                    pollForMachineState(client, call, machineId, 'stopped');
                } else {
                    call.done(err);
                }
            });
        }
    });

    /* GetMachine */
    server.onCall('MachineDelete', {
        verify: function (data) {
            return typeof(data) === 'object' &&
                data.hasOwnProperty('machineId') &&
                data.hasOwnProperty('datacenter');
        },

        handler: function (call) {
            var machineId = call.data.machineId;
            call.log.debug('Deleting machine %s', machineId);

            var client = cloud.proxy(call.data);
            client.deleteMachine(machineId, function (err) {
                if (!err) {
                    pollForMachineState(client, call, machineId, 'deleted');
                } else {
                    call.done(err);
                }
            });
        }
    });

    server.onCall('MachineReboot', {
        verify: function (data) {
            return typeof(data) === 'object' &&
                data.hasOwnProperty('machineId') &&
                data.hasOwnProperty('datacenter');
        },
        handler: function (call) {
            var machineId = call.data.machineId;
            call.log.debug('Rebooting machine %s', machineId);

            var client = cloud.proxy(call.data);
            client.rebootMachine(machineId, function (err, machine) {
                if (!err) {
                    pollForMachineState(client, call, machineId, 'running');
                } else {
                    call.done(err);
                }
            });
        }
    });

    /* ResizeMachine */
    server.onCall('MachineResize', {
        verify: function (data) {
            return typeof(data) === 'object' &&
                data.hasOwnProperty('machineId') &&
                data.hasOwnProperty('datacenter') &&
                data.hasOwnProperty('sdcpackage') &&
                data.sdcpackage.hasOwnProperty('name');
        },

        handler: function (call) {
            var machineId = call.data.machineId;
            var options = {
                package: call.data.sdcpackage.name
            };

            call.log.debug('Resizing machine %s', machineId);

            var client = cloud.proxy(call.data);
            client.resizeMachine(machineId, options, function (err) {
                if (!err) {
                    pollForMachinePackageChange(client, call, call.data.sdcpackage)
                } else {
                    call.done(err);
                }
            });
        }
    });

    /* ResizeMachine */
    server.onCall('MachineCreate', {
        verify: function (data) {
            return typeof(data) === 'object' &&
                data.sdcpackage.hasOwnProperty('name') &&
                data.hasOwnProperty('dataset') &&
                data.dataset.hasOwnProperty('urn');
        },

        handler: function (call) {
            var options = {
                name: call.data.name,
                package: call.data.sdcpackage.name,
                dataset: call.data.dataset.urn
            };

            call.log.debug('Creating machine %s', call.data.name);

            var client = cloud.proxy();
            client.createMachine(options, function (err, machine) {
                if (!err) {
                    call.result = {
                        machine: machine
                    };

                    pollForMachineState(client, call, machine.id, 'running');
                } else {
                    call.done(err);
                }
            });
        }
    });

    setImmediate(callback);
}