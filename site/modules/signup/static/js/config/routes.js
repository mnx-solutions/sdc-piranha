'use strict';

JoyentPortal.config(function($routeProvider) {
	$routeProvider
		.when('/signup', {
			action: 'signup.index'
		}
	);
});
