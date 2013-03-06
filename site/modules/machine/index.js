'use strict';

var express = require('express');
var app = express();

app.get('/', function (req, res) {
    req.cloud.listMachines(function (err, machines) {
        if (!err) {
            res.json(machines);
        }
    })
});

var events = JP.getModuleAPI("Server");

events.registerEvent("getMachineList", function (req, session, data) {

    JP.getLog().debug("handling machine list event", req.cloud);
    req.cloud.listMachines(function (err, machines) {
        if (!err) {
            events.send("MachineList",session, machines);
        }
    });
});

events.registerCallHandler("waitForStatusChange", function (req, session, data) {
    JP.getLog().debug("handling machine list event", req.cloud);
    req.cloud.listMachines(function (err, machines) {
        if (!err) {
            events.send("MachineList",session, machines);
        }
    });
});

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
