'use strict';

module.exports = function (scope, app, callback) {

	app.post('/', function (req, res) {
		var login = req.body;
		req.session.login = login;
		login.success = true;
		res.json(login);
	});
	setImmediate(callback);
}