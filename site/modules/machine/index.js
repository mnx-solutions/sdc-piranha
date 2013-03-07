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

var machineList = function (cloud, data, cb) {
    JP.getLog().debug("handling machine list event");

    cloud.listMachines(function (err, machines) {
        if (!err) {
            cb(null, machines);
        } else {
            cb(err, machines);
        }
    });
}

machineList.prototype.verifyOpts = function (data) {
    console.log("verify called")
    if (data == null) {
        return false;
    }
}

events.registerCallHandler("MachineList", machineList);

events.registerCallHandler("MachineDetails", function (cloud, data, cb) {
    JP.getLog().debug("handling machine list event");

    cloud.getMachine(data, function (err, machine) {
        if (!err) {
            cb(null, machine);
        } else {
            cb(err, machine);
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
