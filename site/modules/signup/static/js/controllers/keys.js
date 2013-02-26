'use strict';

(function(ng, app) {
	app.controller(
		'KeysController',
		function($scope, $timeout, account, navigation) {
			$scope.user = account.getUser();

			$scope.submit = function() {
				/*
				$timeout(function() {
					$scope.$emit('step:success', navigation.selectedItem);
				}, 1000);
				*/

				// TODO: Validation
				account.createKey({
					name: $scope.name,
					key: $scope.content
				}, function(err, key) {
					if (err) {
						$scope.$emit('step:error',
							err, navigation.selectedItem);
						return;
					}

					ng.element('#keyModal').modal('hide');
					$scope.$emit('step:success', navigation.selectedItem);
				});
			};
		}
	);
})(window.angular, window.JoyentPortal);