'use strict';

var express = require('express');
var app = express();

var server = JP.getModuleAPI("Server");

server.onCall("MachineList", function (call) {
    call.log.debug("handling machine list event");

    call.cloud.listMachines(function (err, machines) {
        if (!err) {
            call.done(null, machines);
        } else {
            call.done(err, machines);
        }
    });
});

/* listPackages */
server.onCall("PackageList", function (call) {
    call.log.debug("handling list packages event");

    call.cloud.listPackages(function (err, packages) {
        if (!err) {
            call.done(null, packages);
        } else {
            call.done(err, packages);
        }
    });
});

/* GetMachine */
server.onCall("MachineDetails", {
    verify: function (data) {
        return "string" == typeof data;
    },
    handler: function (call) {
        call.log.debug("handling machine details call");

        call.cloud.getMachine(call.data, function (err, machine) {
            if (!err) {
                call.done(null, machine);
            } else {
                call.done(err, machine);
            }
        });
    }
});


/* listMachineTags */
server.onCall("MachineTags", {
    verify: function (data) {
        return "string" == typeof data;
    },
    handler: function (call) {
        call.log.debug("handling machine tags call");

        call.cloud.listMachineTags(call.data, function (err, machine) {
            if (!err) {
                call.done(null, machine);
            } else {
                call.done(err, machine);
            }
        });
    }
});

function pollForMachineState(call, state) {
    var timer = setInterval(function () {

        var machineId = call.data;

        call.log.debug("Polling for machine %s to become %s", machineId, state);
        call.cloud.getMachine(machineId, function (err, machine) {
            if (!err) {
                if (state == machine.state) {
                    call.log.debug("machine %s state is %s as expected, returing call", machineId, state);
                    call.done(null, machine);
                    clearInterval(timer);
                } else {
                    call.log.debug("machine %s state is %s, waiting for %s", machineId, machine.state, state);
                    call.progress({state: machine.state});
                }
            }
        });
    }, 1000);
}

function pollForMachinePackageChange(call, sdcpackage) {
    var timer = setInterval(function () {

        if ("object" == typeof(call.data)) {
            var machineId = call.data.machineid;
        } else {
            var machineId = call.data;
        }

        call.log.debug("Polling for machine %s to resize to %s", machineId, sdcpackage.memory);
        call.cloud.getMachine(machineId, function (err, machine) {
            if (!err) {
                if (sdcpackage.memory == machine.memory) {
                    call.log.debug("machine %s resized to %s as expected, returing call", machineId, sdcpackage.memory);
                    call.done(null, machine);
                    clearInterval(timer);
                } else {
                    call.log.debug("machine %s memory size is %s, waiting for %s", machineId, machine.memory, sdcpackage.memory);
                    call.progress({state: 'resizing'});
                }
            }
        });
    }, 1000);
}

/* GetMachine */
server.onCall("MachineStart", {
    verify: function (data) {
        return "string" == typeof data;
    },
    handler: function (call) {
        var machineId = call.data;

        call.log.debug("Starting machine %s", machineId);
        call.cloud.startMachine(machineId, function (err) {
            if (!err) {
                pollForMachineState(call, "running");
            } else {
                call.done(err);
            }
        });
    }
});

/* GetMachine */
server.onCall("MachineStop", {
    verify: function (data) {
        return "string" == typeof data;
    },
    handler: function (call) {

        var machineId = call.data;

        call.log.debug("Stopping machine %s", machineId);
        call.cloud.stopMachine(machineId, function (err) {
            if (!err) {
                pollForMachineState(call,"stopped");
            } else {
                call.done(err);
            }
        });
    }
});

/* GetMachine */
server.onCall("MachineReboot", {
    verify: function (data) {
        return "string" == typeof data;
    },
    handler: function (call, machineId, done, progress) {

        var machineId = call.data;

        call.log.debug("Rebooting machine %s", machineId);
        call.cloud.rebootMachine(machineId, function (err) {
            if (!err) {
                pollForMachineState(call, "running")
            } else {
                call.done(err);
            }
        });
    }
});

/* ResizeMachine */
server.onCall("MachineResize", {
    verify: function (data) {
        return "object" == typeof data;
    },
    handler: function (call, machineId, options, done, progress) {

        var machineId = call.data.machineid;
        var options = {};
        options.package = call.data.sdcpackage.name;

        call.log.debug("Resizing machine %s", machineId);
        call.cloud.resizeMachine(machineId, options, function (err) {
            if (!err) {
                pollForMachinePackageChange(call, call.data.sdcpackage)
            } else {
                call.done(err);
            }
        });
    }
});


module.exports.app = app;

module.exports.app = app;

module.exports.csss = [
    'css/machines.css'
];

module.exports.javascripts = [
    'js/module.js',
    'js/vendor/transition.js',
    'js/vendor/dialog.js',
    'js/services/machine.js',
    'js/controllers/machine-layout.js',
    'js/controllers/machines.js',
    'js/controllers/machine.js',
    'js/config/routes.js'
];

module.exports.authenticate = true;

module.exports.layouts = [
    {
        name: 'machine',
        module: 'machine',
        include: 'partial/machine.html',
        controller: 'MachineLayoutController'
    }
];
