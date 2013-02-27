'use strict';

(function (ng, app) {
	app.controller(
		'SignupLayoutController',
		['$scope', 'requestContext', function ($scope, requestContext) {
			var renderContext = requestContext.setUpRenderContext('signup', $scope);
		}]
	);
}(window.angular, window.JP.getModule('Signup')));