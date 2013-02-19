'use strict';

var config = require('easy-config');
var express = require('express');
var app = express();

app.use(express.bodyParser());

var Modulizer = require('./lib/modulizer');
var modulizer = new Modulizer(app, { path: process.cwd() + '/site/' });

modulizer.loadApps([ 'main', 'home', 'login', 'signup' ]);

modulizer.loadModuleStack(function() {
  modulizer.registerApps();
  app.listen(3000);
});