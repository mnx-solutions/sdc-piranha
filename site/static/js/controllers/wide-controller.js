'use strict';

window.JP.main.controller(
	'WideController',
	['$scope', 'requestContext', function ($scope, requestContext) {
		var renderContext = requestContext.setUpRenderContext('wide', $scope);
	}]
);