'use strict';

module.exports = function (app) {

	app.get('/', function (req, res) {
		req.cloud.listMachines(function (err, machines) {
			if (!err) {
				res.json(machines);
			}
		});
	});
}