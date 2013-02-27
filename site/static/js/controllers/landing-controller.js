'use strict';

window.JP.main.controller(
	'LandingController',
	['$scope', 'requestContext', function ($scope, requestContext) {
		var renderContext = requestContext.setUpRenderContext('landing', $scope);
	}]
);