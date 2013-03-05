'use strict';

var express = require('express');
var app = express();

app.get('/', function (req, res) {
//    res.json(require('./static/machines.json'));
	req.cloud.listMachines(function (err, machines) {
	if (!err) {
			res.json(machines);
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
