'use strict';

(function(ng, app) {
	app.controller(
		'MachineLayoutController',
		function($scope, requestContext) {
			var renderContext = requestContext.setUpRenderContext('machine', $scope);
		}
	);
})(window.angular, window.JoyentPortal);