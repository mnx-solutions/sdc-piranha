'use strict';

(function (app, $) {
    app.controller(
        'signup.LayoutController',
        ['$scope', 'requestContext', '$location', '$cookies', 'Process', '$http', '$$track','PopupDialog', 'Account',
            function ($scope, requestContext, $location, $cookies, Process, $http, $$track, popupDialog, Account) {
                requestContext.setUpRenderContext('signup', $scope);
                Account.getAccount(true);
                $scope.stepNames = {
                    phone: 'Phone confirmation',
                    billing: 'Payment Method',
                    ssh: 'SSH Key'
                };
                $scope.steps = ['phone', 'billing', 'ssh'];
                $scope.currentStep = $('#signupStep').val();

                $scope.campaignId = $cookies.campaignId;

                $scope.setAttemptId = function(id) {
                    $scope.attemptId = id;
                };

                $scope.setStep = function (step) {
                    $scope.currentStep = step;
                    var stepPath = '/' + step;
                    if ($location.path() !== stepPath) {
	                    $location.path(stepPath);
                    }
                };

                $scope.nextStep = function () {
                    if ($scope.currentStep === 'blocked') {
                        Process.getAttemptId(function(error, attemptId) {
                            $scope.setAttemptId(attemptId);
                        });
                        return;
                    }
                    var i = $scope.steps.indexOf($scope.currentStep);
                    if(++i < $scope.steps.length) {
                        $scope.setStep($scope.steps[i]);
                    } else {
                        window.location.href = '/main';
                    }
                };

                $scope.updateStep = function () {
                    Process.getPreviousStep(function (err, step) {
                        if (!err) {
                            $scope.setStep(step);
                            $scope.nextStep();
                        }
                    });
                };


                $scope.skipSsh = function() {
                    $http.get('/signup/account/signup/skipSsh').success(function(data) {
                        if(data.success === true) {
                            window.top.location.href = '/main';
                        }
                    });
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

                $scope.setStep($scope.currentStep);
                $scope.nextStep();

                $scope.signOut = function() {
                    popupDialog.confirm("Warning",'Clicking Yes will cancel the sign-up to Joyent Cloud',function(){
                        $$track.event('Signup', 'Cancel Signup');
                        window.location = '/landing/forgetToken';
                    });
                    return false;
                };
            }
        ]);
}(window.JP.getModule('Signup'), window.jQuery));