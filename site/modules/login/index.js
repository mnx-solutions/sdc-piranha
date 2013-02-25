'use strict';

var express = require('express');

var app = express();

app.post('/', function (req, res) {
	var login = req.body;
	req.session.login = login;
	login.success = true;
	res.json(login);
});

module.exports = {
	app:app,
	javascripts:[
		'js/module.js',
		'js/controllers/login-controller.js',
		'js/controllers/login-form-controller.js',
		'js/services/login.js',
		'js/directives/login-form.js'
	],
	csss:[
		'css/login.css'
	],
	layouts:[
		{
			name:'login',
			include:'partials/login.html',
			controller:'LoginController'
		}
	]
};