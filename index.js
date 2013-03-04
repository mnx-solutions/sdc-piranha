'use strict';

var express = require('express');
var app = express();

app.set('views', process.cwd() + '/site/views');

var JP = require('./lib/jp');
global.JP = new JP(process.cwd() + '/site/');

app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.session({secret:"secret"}));

var Modulizer = require('./lib/modulizer');
var modulizer = new Modulizer(app);

modulizer.loadApps(['main', 'signup', 'login']);

modulizer.run(function () {
	app.listen(3000);
});