'use strict';

var config = require('easy-config');
var express = require('express');
var bunyan = require('bunyan');
var Rack = require('easy-asset').Rack;
var Modulizer = require('express-modulizer');
var util = require('util');
var utils = require('./lib/utils');
var app = express(); // main app

var Localization = require('./lib/localization');
Localization.configure(utils.extend(
    config.localization,
    {
        log: bunyan.createLogger({
            name: config.log.name,
            module: 'localization'
        })
    }
));

app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({secret:"secret"}));

app.use(Localization.localeParser());
app.use(Localization.registerHelpers());

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
    //console.log(util.inspect(m.app('main').get('locals'), false, 100));
	m.run(3000);
});