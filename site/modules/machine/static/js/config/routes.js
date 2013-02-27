'use strict';

window.JP.main.config(['$routeProvider', function ($routeProvider) {
	$routeProvider
		.when('/machine', {
			action: 'machine.index'
		})
		.when('/machine/details/:machineid', {
			action: 'machine.details'
		});
}]);

window.JP.main.run(['Menu', function (Menu) {
	Menu.register({
		name: 'Machine',
		link: 'machine'
	});
}]);
