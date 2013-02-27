'use strict';

(function (ng, app) {
	app.controller(
		'LoginFormController',
		['$scope', '$http', 'Login', '$window', function ($scope, $http, Login, $window) {
			$scope.login = {
				email: '',
				password: '',
				remember: ''
			};

			$scope.logIn = function () {
				Login.try($scope.login, function (result) {
					if (result.success) {
						$window.location.href = '/app#!/machine';
					}
				});
			};
		}]
	);
}(window.angular, window.JP.getModule('Login')));
