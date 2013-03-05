'use strict';

var express = require('express');
var app = express();

app.get('/', function (req, res) {
//    res.json(require('./static/machines.json'));
    req.cloud.listMachines(function (err, machines) {
        if (!err) {
            res.json(machines);
        }
    })
});

/* GetMachine */
app.get('/:machineid', function (req, res) {
    var machineId = req.param('machineid');
    req.cloud.getMachine(machineId, function (err, machine) {
        if (!err) {
            res.json(machine);
        }
    })
});

/* StartMachine */
app.get('/:machineid/start', function (req, res) {
    var machineId = req.param('machineid');
});

/* StopMachine */
app.get('/:machineid/stop', function (req, res) {
    var machineId = req.param('machineid');
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
