'use strict';

var config = require('easy-config');
var express = require('express');
var bunyan = require('bunyan');
var Rack = require('easy-asset').Rack;
var Modulizer = require('express-modulizer');

var app = express(); // main app
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({secret:"secret"}));

var rack = new Rack();
rack.addMiddleware(app);

var compiler = require('./lib/compiler')(rack, config);

Modulizer.create({
	root: 'site',
	config: config,
	log: bunyan.createLogger(config.log),
	main: app,
	extensions: config.extensions,
	compiler: compiler,
	apps: ['login','main','signup']
}, function (err, m) {
	m.run(3000);
});