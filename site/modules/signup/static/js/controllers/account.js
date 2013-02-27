'use strict';

(function (ng, app) {
	app.controller(
		'AccountController',
		['$scope', '$timeout', 'navigation', function ($scope, $timeout, navigation) {
			$scope.submit = function () {
				// TODO: Verify user data and create a new account
				$timeout(function () {
					$scope.$emit('step:success', navigation.selectedItem);
				}, 1000);
			};
		}]
	);
}(window.angular, window.JP.getModule('Signup')));