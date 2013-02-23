'use strict';

(function(ng, app) {
	app.controller(
		'MachineController',
		function($scope, requestContext) {
			var renderContext = requestContext.setUpRenderContext('machine.details', $scope);
		}
	);
})(window.angular, window.JoyentPortal);