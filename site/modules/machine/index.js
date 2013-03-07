'use strict';

var express = require('express');
var app = express();

var server = JP.getModuleAPI("Server");

server.onCall("MachineList", function (callSession, data, done, progress) {
    callSession.log.debug("handling machine list event");

    progress('start');

    callSession.cloud.listMachines(function (err, machines) {
        if (!err) {
            done(null, machines);
        } else {
        	progress('done');
            done(err, machines);
        }
    });
});

server.onCall("MachineDetails", {
    verify: function (data) {
        return "string" == typeof data;
    },
    handler: function (callSession, data, done, progress) {
        callSession.log.debug("handling machine details call");

        callSession.cloud.getMachine(data, function (err, machine) {
            if (!err) {
                done(null, machine);
            } else {
                done(err, machine);
            }
        });
    }
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
