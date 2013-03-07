'use strict';

var express = require('express');
var app = express();

var server = JP.getModuleAPI("Server");

server.onCall("MachineList", function (callSession, data, cb) {
    callSession.log.debug("handling machine list event");

    callSession.cloud.listMachines(function (err, machines) {
        if (!err) {
            cb(null, machines);
        } else {
            cb(err, machines);
        }
    });
});

/* GetMachine */
server.onCall("MachineDetails", {
    verify: function (data) {
        return "string" == typeof data;
    },
    handler: function (callSession, data, cb) {
        callSession.log.debug("handling machine details call");

        callSession.cloud.getMachine(data, function (err, machine) {
            if (!err) {
                cb(null, machine);
            } else {
                cb(err, machine);
            }
        });
    }
});


function pollForMachineState(callSession, machineId, state, cb) {
    var timer = setInterval(function () {
        callSession.logger.debug("Polling for machine %s to become %status", machineId, status);
        callSession.cloud.getMachine(data, function (err, machine) {
            if (!err) {
                if (state == machine.state){
                    callSession.logger.debug("machine %s state is %s as expected, returing call", machineId, state);
                    cb(null, machine);
                } else {
                    callSession.logger.debug("machine %s state is %s, waiting for %s", machineId, machine.state, state);
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
    handler: function (callSession, machineId, cb) {
        callSession.log.debug("Starting machine %s", machineId);
        req.cloud.startMachine(machineId, function (err) {
            if (!err) {
                pollForMachineState(callSession, machineId, "running", cb)
            } else {
                cb(err);
            }
        });
    }
});

/* GetMachine */
server.onCall("MachineStop", {
    verify: function (data) {
        return "string" == typeof data;
    },
    handler: function (callSession, machineId, cb) {
        callSession.log.debug("Starting machine %s", machineId);
        req.cloud.stopMachine(machineId, function (err) {
            if (!err) {
                pollForMachineState(callSession, machineId, "stopped", cb)
            } else {
                cb(err);
            }
        });
    }
});

/* GetMachine */
server.onCall("MachineReboot", {
    verify: function (data) {
        return "string" == typeof data;
    },
    handler: function (callSession, machineId, cb) {
        callSession.log.debug("Starting machine %s", machineId);
        req.cloud.rebootMachine(machineId, function (err) {
            if (!err) {
                pollForMachineState(callSession, machineId, "running", cb)
            } else {
                cb(err);
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
