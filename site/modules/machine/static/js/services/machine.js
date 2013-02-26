'use strict';


(function (ng, app) {
	app.factory('Machines', ['$resource', function ($resource) {
		var service = {};

		var machines = [];
		var machineMap = {};

		// load machines
		machines = $resource('/machine', {}, {}).query();

		/* get reference to the machines list */
		service.getMachines = function () {
			return machines;
		};

		/* find machine by uuid */
		service.getMachine = function (uuid) {
			return machines.filter(function (machine) {
				return machine.id === uuid;
			});
		};

		return service;
	}]);
})(window.angular, window.JoyentPortal);
