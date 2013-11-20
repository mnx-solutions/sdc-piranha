'use strict';

(function (app) {
    app.controller(
        'Signup.PhoneController',
        ['$scope', 'Account', 'localization', 'requestContext', 'notification', 'Phone', '$q',
            function ($scope, Account, localization, requestContext, notification, Phone, $q) {
            requestContext.setUpRenderContext('signup.phone', $scope);
            localization.bind('signup', $scope);

            $scope.pin = null;
            $scope.phone = null;

            $scope.callInProgress = false;
            $scope.lastCalledNumber = null;
            $scope.numberChanged = false;
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
                Phone.makeCall($scope.phone.replace(/[^0-9]/g,''), function (err, data) {
                    $scope.callInProgress = false;
                    if (err) {
                        notification.replace('phone', { type: 'error' }, err);
                        if (data.navigate) {
                            $scope.updateStep();
                        }
                        return;
                    }
                    if (data.navigate) {
                        notification.dismiss('phone');
                        $scope.updateStep();
                    } else {
                        notification.replace('phone', { type: 'success' }, data.message);
                    }
                });
            };

            $scope.verifyPin = function () {
                if (!$scope.pin) {
                    return;
                }
                $scope.callInProgress = true;
                Phone.verify($scope.pin, function (err, data) {
                    $scope.callInProgress = false;
                    if (err) {
                        notification.replace('phone', { type: 'error' }, err);
                        if (data.navigate) {
                            $scope.updateStep();
                        }
                        return;
                    }
                    Account.updateAccount({
                        phone: $scope.phone
                    }).then(function () {
                        notification.dismiss('phone');
                        $scope.updateStep();
                    });
                });
            };
        }]);
}(window.JP.getModule('Signup')));
