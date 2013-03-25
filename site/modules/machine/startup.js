'use strict';

var smartdc = require('smartdc');
var vasync = require('vasync');

module.exports = function (scope, callback) {
    var server = scope.api('Server');

    server.onCall('MachineList', function (call) {
        call.log.debug('handling machine list event');
        var datacenters = {};

        vasync.pipeline({
            'funcs': [
                function (args, next) {
                    call.cloud.listDatacenters(function (err, dcs) {
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
                        var client = null;

                        if (scope.config.cloudapi &&
                            scope.config.cloudapi.keyId &&
                            scope.config.cloudapi.keyPath) {
                            client = smartdc.createClient({
                                url: datacenters[name],
                                sign: scope.get('utils').getRequestSigner(scope.config.cloudapi),
                                logger: call.log
                            });
                        }

                        if (scope.config.cloudapi &&
                            scope.config.cloudapi.username &&
                            scope.config.cloudapi.password) {
                            client = smartdc.createClient({
                                url: datacenters[name],
                                username: scope.config.cloudapi.username,
                                password: scope.config.cloudapi.password,
                                logger: call.log
                            });
                        }

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
                                response.status = 'complete';
                                response.machines = machines;
                            }

                            call.update(null, response, (--count === 0));
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
        call.log.debug('handling list packages event');

        call.cloud.listPackages(function (err, packages) {
            call.update(err, packages, true);
        });
    });

    /* listDatasets */
    server.onCall('DatasetList', function (call) {
        call.log.debug('handling list datasets event');

        call.cloud.listDatasets(function (err, datasets) {
            call.done(err, datasets);
        });
    });

    /* listDatasets */
    server.onCall('DatacenterList', function (call) {
        call.log.debug('handling list datasets event');

        call.cloud.listDatacenters(function (err, datacenters) {
            call.done(err, datacenters);
        });
    });


    /* listMachineTags */
    server.onCall('MachineTags', {
        verify: function (data) {
            return 'string' === typeof data;
        },
        handler: function (call) {
            call.log.debug('handling machine tags call');

            call.cloud.listMachineTags(call.data, function (err, machine) {
                call.done(err, machine);
            });
        }
    });

    /* GetMachine */
    server.onCall('MachineDetails', {
        verify: function (data) {
            return 'string' === typeof data;
        },
        handler: function (call) {
            call.log.debug('handling machine details call');

            call.cloud.getMachine(call.data, function (err, machine) {
                call.done(err, machine);
            });
        }
    });


    /* listMachineTags */
    server.onCall('MachineTags', {
        verify: function (data) {
            return 'string' === typeof data;
        },
        handler: function (call) {
            call.log.debug('handling machine tags call');

            call.cloud.listMachineTags(call.data, function (err, machine) {
                call.done(err, machine);
            });
        }
    });

    function pollForMachineState(call, machineId, state) {
        var timer = setInterval(function () {
            call.log.debug('Polling for machine %s to become %s', machineId, state);
            call.cloud.getMachine(machineId, function (err, machine) {
                if (!err) {
                    if (state === machine.state) {
                        call.log.debug('machine %s state is %s as expected, returing call', machineId, state);
                        call.done(null, machine);
                        clearInterval(timer);
                    } else {
                        call.log.trace('machine %s state is %s, waiting for %s', machineId, machine.state, state);
                        call.step = {state: machine.state};
                    }
                }
            });
        }, 5000);
    }

    function pollForMachinePackageChange(call, sdcpackage) {
        var timer = setInterval(function () {
            var machineId = typeof call.data === 'object' ? call.data.uuid : call.data;

            call.log.debug('Polling for machine %s to resize to %s', machineId, sdcpackage.memory);
            call.cloud.getMachine(machineId, function (err, machine) {
                if (!err) {
                    if (sdcpackage.memory === machine.memory) {
                        call.log.debug('machine %s resized to %s as expected, returing call', machineId, sdcpackage.memory);
                        call.done(null, machine);
                        clearInterval(timer);
                    } else {
                        call.log.debug('machine %s memory size is %s, waiting for %s', machineId, machine.memory, sdcpackage.memory);
                        call.step = {state: 'resizing'};
                    }
                }
            });
        }, 1000);
    }

    /* GetMachine */
    server.onCall('MachineStart', {
        verify: function (data) {
            return data && 'string' === typeof data.uuid;
        },
        handler: function (call) {
            var machineId = call.data.uuid;

            call.log.debug('Starting machine %s', machineId);
            call.cloud.startMachine(machineId, function (err) {
                if (!err) {
                    pollForMachineState(call, machineId, 'running');
                } else {
                    call.done(err);
                }
            });
        }
    });

    /* GetMachine */
    server.onCall('MachineStop', {
        verify: function (data) {
            return data && 'string' === typeof data.uuid;
        },
        handler: function (call) {

            var machineId = call.data.uuid;

            call.log.debug('Stopping machine %s', machineId);
            call.cloud.stopMachine(machineId, function (err) {
                if (!err) {
                    pollForMachineState(call, machineId, 'stopped');
                } else {
                    call.done(err);
                }
            });
        }
    });

    /* GetMachine */
    server.onCall('MachineDelete', {
        verify: function (data) {
            return data && 'string' === typeof data.uuid;
        },
        handler: function (call) {
            var machineId = call.data.uuid;

            call.log.debug('Deleting machine %s', machineId);
            call.cloud.deleteMachine(machineId, function (err) {
                if (!err) {
                    pollForMachineState(call, machineId, 'deleted');
                } else {
                    call.done(err);
                }
            });
        }
    });


    server.onCall('MachineReboot', {
        verify: function (data) {
            return data && 'string' === typeof data.uuid;
        },
        handler: function (call) {

            var machineId = call.data.uuid;

            call.log.debug('Rebooting machine %s', machineId);
            call.cloud.rebootMachine(machineId, function (err, machine) {
                if (!err) {
                    pollForMachineState(call, machineId, 'running');
                } else {
                    call.done(err);
                }
            });
        }
    });

    /* ResizeMachine */
    server.onCall('MachineResize', {
        verify: function (data) {
            if ('object' === typeof data &&
                data &&
                data.uuid &&
                data.sdcpackage.name) {
                return true;
            }
            return false;
        },
        handler: function (call) {

            var machineId = call.data.uuid;
            var options = {};

            options.package = call.data.sdcpackage.name;

            call.log.debug('Resizing machine %s', machineId);
            call.cloud.resizeMachine(machineId, options, function (err) {
                if (!err) {
                    pollForMachinePackageChange(call, call.data.sdcpackage);
                } else {
                    call.done(err);
                }
            });
        }
    });

    /* ResizeMachine */
    server.onCall('MachineCreate', {
        verify: function (data) {
            return 'object' === typeof data;
        },
        handler: function (call) {

            var options = {};
            options.name = call.data.name;
            options.package = call.data.sdcpackage.name;
            options.dataset = call.data.dataset.urn;

            call.log.debug('Creating machine %s', call.data.name);
            call.getImmediate(false);
            call.cloud.createMachine(options, function (err, machine) {
                if (!err) {
                    call.immediate(null, {machine: machine});
                    pollForMachineState(call, machine.id, 'running');
                } else {
                    call.immediate(err);
                }
            });
        }
    });

    setImmediate(callback);
}