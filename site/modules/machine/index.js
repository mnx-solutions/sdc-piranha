'use strict';

var express = require('express');
var app = express();

app.get('/', function(req, res) {
	res.json(require('./static/machines.json'));
});

module.exports.app = app;

module.exports.css = [ 'css/main.css' ];
module.exports.javascripts = [
	'js/services/machine.js',
	'js/directives/machine-list.js',
	'js/controllers/machine-layout.js',
	'js/controllers/machines.js',
	'js/controllers/machine.js',
	'js/config/routes.js'
];

module.exports.layouts = [{
    name: 'machine',
    include: 'partial/machine.html',
    controller: 'MachineLayoutController'
}];