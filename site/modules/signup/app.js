'use strict';

var fs = require('fs');
var mustache = require('mustache');

module.exports = function (scope, app, callback) {
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

	setImmediate(callback);
};