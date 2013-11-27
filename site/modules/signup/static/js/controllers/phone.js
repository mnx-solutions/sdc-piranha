'use strict';

(function (app) {
    app.controller(
        'Signup.PhoneController',
        ['$scope', 'Account', 'localization', 'requestContext', 'notification', 'Phone', '$q',
            function ($scope, Account, localization, requestContext, notification, Phone, $q) {
                requestContext.setUpRenderContext('signup.phone', $scope);
                localization.bind('signup', $scope);

                $scope.pin = null;

                $scope.countryCodes = null;
                $scope.country = null;
                $scope.phone = null;

                $scope.selectedCountryCode = '1';

                $scope.callInProgress = false;
                $scope.lastCalledNumber = null;

                Account.getAccount(true).then(function (account) {
                    $scope.phone = account.phone || '';
                });

                $scope.$watch('phone', function (newVal) {
                    $scope.numberChanged = newVal !== $scope.lastCalledNumber;
                });

                $scope.makeCall = function() {
                    if (!$scope.phone || $scope.callInProgress || !$scope.numberChanged) {
                        return;
                    }
                    $scope.callInProgress = true;
                    $scope.lastCalledNumber = $scope.phone;
                    Phone.makeCall($scope.phone, function (err, data) {
                        if (err) {
                            $scope.phoneError = err;
                            $scope.callInProgress = false;
                            if (data.navigate) {
                                $scope.updateStep();
                            }
                            return;
                        }
                        if (data.navigate) {
                            $scope.phoneError = null;
                            $scope.updateStep();
                        } else {
                            $scope.phoneError = null;
                        }
                    });
                };

                $scope.verifyPin = function () {
                    var expr = /^\d{4}$/g; //only 4 digits
                    $scope.pinError = null;
                    $scope.pinIsInvalid = !expr.test($scope.pin);

                    if (!$scope.pin || $scope.pinIsInvalid) {
                        return;
                    }
                    $scope.callInProgress = false;
                    Phone.verify($scope.pin, function (err, data) {
                        if (err) {
                            notification.replace('phone', { type: 'error' }, err);
                            $scope.pinError = err;
                            if (data.navigate) {
                                $scope.updateStep();
                            }
                            return;
                        }
                        Account.updateAccount({
                            phone: $scope.phone
                        }).then(function () {
                                notification.dismiss('phone');
                                $scope.pinError = null;
                                $scope.updateStep();
                            });
                    });
                };
            }]);
}(window.JP.getModule('Signup')));