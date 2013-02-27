'use strict';

window.JP.main.config(['$routeProvider', function ($routeProvider) {
	$routeProvider
		.when('/signup', {
			action: 'signup.index'
		});
}]);

window.JP.main.run(function (Menu) {
	Menu.register({
		name: 'Signup',
		link: 'signup'
	});
});