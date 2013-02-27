'use strict';

(function (ng, app) {
	app.controller(
		'MachineLayoutController',
		['$scope', 'requestContext', function ($scope, requestContext) {
			var renderContext = requestContext.setUpRenderContext('machine', $scope);
		}]
	);
}(window.angular, window.JP.getModule('Machine')));