'use strict';

var fs = require('fs');
var mustache = require('mustache');
var express = require('express');
var app = express();

//app.set('view engine', 'mustache');
//app.set('views', __dirname + '/static/partial');

app.get('/ssh-key-generator', function (req, res, next) {
	fs.readFile(__dirname + '/static/partial/ssh-key-generator.html', function (err, data) {
		if (err) {
			res.send(500, 'Unable to generate SSH generator script');
			return;
		}

		var output = mustache.render(data.toString(), { username: req.query.username || '' });

		res.setHeader('Content-Disposition', 'attachment; filename=ssh-key-generator.sh');
		res.setHeader('Content-Type', 'application/octet-stream');
		res.send(200, output);
	});
});

module.exports.app = app;

module.exports.csss = [ 'css/main.css' ];
module.exports.javascripts = [
	'js/module.js',
	'js/controllers/signup-layout.js',
	'js/controllers/account.js',
	'js/controllers/verification.js',
	'js/controllers/payment.js',
	'js/controllers/signup.js',
	'js/controllers/keys.js',
	'js/config/routes.js',
	'js/services/navigation.js'
];

module.exports.layouts = [{
	name: 'signup',
	module: 'signup',
	include: 'partial/signup.html',
	controller: 'SignupLayoutController'
}];