'use strict';

var express = require('express');
var app = express();

app.set('views', process.cwd() + '/site/views');

var JP = require('./lib/jp');
global.JP = new JP(process.cwd() + '/site/');

app.use(express.bodyParser());

var Modulizer = require('./lib/modulizer');
var modulizer = new Modulizer(app);

modulizer.loadApps(['main', 'landing', 'signup']);

modulizer.run(function() {
  app.listen(3000);
});