'use strict';

(function(ng, app) {
	app.controller(
		'SignupLayoutController',
		function($scope, requestContext) {
			var renderContext = requestContext.setUpRenderContext('signup', $scope);
		}
	);
})(angular, JoyentPortal);