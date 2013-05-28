'use strict';

module.exports = function execute(scope, app) {

	app.post('/', function (req, res) {
		var login = req.body;
		req.session.login = login;
		login.success = true;
		res.json(login);
	});
};