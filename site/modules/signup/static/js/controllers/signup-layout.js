'use strict';

(function (app, $) {
    app.controller(
        'signup.LayoutController',
        ['$scope', 'requestContext', '$location', '$cookies', 'Process', '$http', '$$track', 'Account', 'PopupDialog',
            function ($scope, requestContext, $location, $cookies, Process, $http, $$track, Account, PopupDialog) {

                requestContext.setUpRenderContext('signup', $scope);

                Account.getAccount(true);

                $scope.stepNames = {
                    phone: 'Phone confirmation',
                    billing: 'Payment Method',
                    ssh: 'SSH Key'
                };
                $scope.steps = ['phone', 'billing', 'ssh'];
                if ($scope.features.phoneVerification !== 'enabled') {
                    $scope.steps.splice($scope.steps.indexOf('phone'), 1);
                }
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
                        window.location.href = $cookies.signupRedirectUrl || '/main';
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


                $scope.skipSsh = function () {
                    $http.get('/signup/account/signup/skipSsh').success(function (data) {
                        if (data.success === true) {
                            window.top.location.href = data.redirectUrl || $cookies.signupRedirectUrl || '/main';
                        }
                    });
                };

                $scope.passSsh = function (url) {
                    $http.get('/signup/account/signup/passSsh').success(function (result) {
                        // marked ssh step as passed
                        window.location.href = result.redirectUrl || $cookies.signupRedirectUrl || url;
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
                    PopupDialog.confirm("Warning",'Clicking Yes will cancel the sign-up to Joyent Cloud',function(){
                        $$track.event('Signup', 'Cancel Signup');
                        window.location = 'signup/cancel';
                    });
                    return false;
                };
                $scope.skipBilling = function () {
                    $http.get('/signup/account/signup/skipBilling').success(function (data) {
                        if (data.success === true) {
                            window.location.href = '/main';
                        }
                    });
                };
            }
        ]);
}(window.JP.getModule('Signup'), window.jQuery));