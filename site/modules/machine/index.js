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


function pollForMachineState(call) {
    var timer = setInterval(function () {

        var machineId = call.data;

        call.log.debug("Polling for machine %s to become %status", machineId, status);
        call.cloud.getMachine(data, function (err, machine) {
            if (!err) {
                if (state == machine.state) {
                    call.log.debug("machine %s state is %s as expected, returing call", machineId, state);
                    call.done(null, machine);
                } else {
                    call.log.debug("machine %s state is %s, waiting for %s", machineId, machine.state, state);
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
                pollForMachineState(call)
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

        call.log.debug("Starting machine %s", machineId);
        call.cloud.stopMachine(machineId, function (err) {
            if (!err) {
                pollForMachineState(call)
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

        call.log.debug("Starting machine %s", machineId);
        call.cloud.rebootMachine(machineId, function (err) {
            if (!err) {
                pollForMachineState(call)
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
