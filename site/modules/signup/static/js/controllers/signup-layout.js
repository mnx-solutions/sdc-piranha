'use strict';

(function (app, $) {
    app.controller(
        'signup.LayoutController',
        ['$scope', 'requestContext', '$location', '$cookies',
            function ($scope, requestContext, $location, $cookies) {
                requestContext.setUpRenderContext('signup', $scope);
				
				$scope.stepNames = {
					tropo:"Phone confirmation",
					billing:"Payment Method",
					ssh:"SSH Key"
				};
				$scope.steps = ['tropo', 'billing','ssh'];
                $scope.currentStep = $('#signupStep').val();

                $scope.campaignId = $cookies.campaignId;

                $scope.setStep = function (step) {
                    $scope.currentStep = step;
                    $location.path('/' + step);
                };

                $scope.nextStep = function () {
                    var i = $scope.steps.indexOf($scope.currentStep);
                    if(++i < $scope.steps.length) {
                        $scope.setStep($scope.steps[i]);
                    } else {
                        window.location.href = '/main';
                    }
                };

                $scope.skipSsh = function() {
                    window.location.href = '/signup/account/signup/skipSsh';
                };

                $scope.location = window.location;

                var i = 0;

                $scope.$watch('location.hash', function (val, oldval) {
                    if($scope.steps.indexOf(val.substring(3)) !== $scope.currentStep && val !== '#!/start') {
                        $scope.setStep($scope.currentStep);
                    }

                    if(val === '#!/start' && i > 0) {
                        $scope.setStep($scope.steps[0]);
                    }
                    i++;
                }, true);

                $scope.$on('creditCardUpdate', function () {
                    $scope.nextStep();
                });

                $scope.nextStep();

                $scope.signOut = function() {
					var msg = confirm('This will cancel your sign-up process. Are you sure you want that?');
					if(msg){
						window.location = '/landing/forgetToken';
					}
                    return false;
                }
            }
        ]);
}(window.JP.getModule('Signup'), window.jQuery));