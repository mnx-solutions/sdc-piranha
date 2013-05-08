'use strict';

(function (app, $) {
    app.controller(
        'signup.LayoutController',
        ['$scope', 'requestContext', '$location',
            function ($scope, requestContext, $location) {
                requestContext.setUpRenderContext('signup', $scope);

                $scope.steps = ['start', 'accountInfo', 'tropo', 'billing','ssh'];
                $scope.currentStep = $('#signupStep').val();

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

                $scope.$on('creditCardUpdate', function () {
                    $scope.nextStep();
                });

                $scope.nextStep();
            }
        ]);
}(window.JP.getModule('Signup'), window.jQuery));