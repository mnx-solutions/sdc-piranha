'use strict';

var smartdc = require('smartdc');
var express = require('express');
var config = require('easy-config');
var app = express();

var client = smartdc.createClient({
  url: 'https://10.88.88.3',
  username: 'admin',
  password: 'parool'
});

app.get('/', function(req, res, next) {
	client.getAccount(function(err, account) {
		if (err) {
			res.send(500, err.message);
			return;
		}

		res.send(200, account);
	});
});

app.post('/', function(req, res, next) {
	client.updateAccount(req.body, function(err, account) {
		if (err) {
			res.send(500, err.message);
			return;
		}

		res.send(200, account);
	});
});

app.get('/keys', function(req, res, next) {
	client.listKeys(function(err, keys) {
		if (err) {
			res.send(500, err.message);
			return;
		}

		res.send(200, keys);
	});
});

app.post('/keys', function(req, res, next) {
	client.createKey({ name: req.body.name, key: req.body.key }, function(err, key) {
		if (err) {
			res.send(500, err.message);
			return;
		}

		res.send(200, key);
	});
});

module.exports.app = app;

module.exports.csss = [ 'css/main.css' ];
module.exports.javascripts = [
	'js/services/account.js'
];

module.exports.layouts = [{
	name: 'signup',
	include: 'partial/account.html',
	controller: 'SignupLayoutController'
}];