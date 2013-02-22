'use strict';

(function(ng, app) {
	app.controller(
		'SignupController',
		function($scope, requestContext, navigation) {
			var renderContext = requestContext.setUpRenderContext('signup.index', $scope);

			// Build navigation stack
			navigation.push(new NavigationItem({
				id: 'step-1',
				name: 'Create Account',
				partial: 'static/partial/steps/step-account.html'
			}));

			navigation.push(new NavigationItem({
				id: 'step-2',
				name: 'Phone Verification',
				partial: 'static/partial/steps/step-verification.html'
			}));

			navigation.push(new NavigationItem({
				id: 'step-3',
				name: 'Payment Method',
				partial: 'static/partial/steps/step-payment.html'
			}));

			navigation.push(new NavigationItem({
				id: 'step-4',
				name: 'SSH Keys',
				partial: 'static/partial/steps/step-keys.html'
			}));

			navigation.item(0).state = NavigationItem.STATE.INPROGRESS;
			navigation.item(0).selected = true;

			$scope.navigation = navigation;

			/**
			 * Controller public methods
			 */

			$scope.navigateToStep = function(step) {
				navigation.selectItemAtIndex(step);
			};

			$scope.pageLoaded = function() {
				angular.element('.-help').bind({
					mouseover: function() {
						$(this).tooltip('show');
					},

					mouseout: function() {
						$(this).tooltip('hide');
					}
				});
			};

			/**
			 * Events
			 */

			$scope.$on('step:success', function() {
				console.log('success');

				// Proceed to the next step
				navigation.selectedItem.state = NavigationItem.STATE.COMPLETE;
				navigation.selectNextItem();
				navigation.selectedItem.state = NavigationItem.STATE.INPROGRESS;
			});

			$scope.$on('step:error', function() {
				console.log('error');
			});
		}
	);

})(angular, JoyentPortal);