'use strict';

JoyentPortal.config(function($routeProvider) {
	$routeProvider
		.when('/machine', {
			action: 'machine.index'
		})
		.when('/machine/details', {
			action: 'machine.details'
		});
});