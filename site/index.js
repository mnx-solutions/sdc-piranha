'use strict';

var express = require('express');
var app = express();
var util = require('util');
var JP = require('../lib/jp');

global.JP = new JP();

app.use(express.bodyParser());

var Modulizer = require('../lib/modulizer');
var modulizer = new Modulizer(app);

modulizer.loadApps(['login', 'signup']);
modulizer.run(function() {
  app.listen(3000);
});