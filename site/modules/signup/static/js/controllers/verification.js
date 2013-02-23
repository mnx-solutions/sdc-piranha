'use strict';

(function(ng, app) {
	app.controller(
		'VerificationController',
		function($scope, $timeout, navigation) {
			$scope.submit = function() {
				// TODO: Verify user data and create a new account
				$timeout(function() {
					$scope.$emit('step:success', navigation.selectedItem);
				}, 1000);
			};
		}
	);
})(window.angular, window.JoyentPortal);