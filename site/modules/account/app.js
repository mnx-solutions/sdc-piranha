'use strict';


var smartdc = require('smartdc');
var client = smartdc.createClient({
  url: 'https://10.88.88.3',
  username: 'admin',
  password: 'joypass123'
});

module.exports = function (app) {

	app.get('/', function (req, res, next) {
		client.getAccount(function (err, account) {
			if (err) {
				res.send(500, err.message);
				return;
			}

			res.send(200, account);
		});
	});

	app.post('/', function (req, res, next) {
		client.updateAccount(req.body, function (err, account) {
			if (err) {
				res.send(500, err.message);
				return;
			}

			res.send(200, account);
		});
	});

	app.get('/keys', function (req, res, next) {
		client.listKeys(function (err, keys) {
			if (err) {
				res.send(500, err.message);
				return;
			}

			res.send(200, keys);
		});
	});

	app.post('/keys', function (req, res, next) {
		client.createKey({ name: req.body.name, key: req.body.key }, function (err, key) {
			if (err) {
				res.send(500, err.message);
				return;
			}

			res.send(200, key);
		});
	});
}
