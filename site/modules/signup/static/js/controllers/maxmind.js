'use strict';

(function (app) {
    app.controller(
        'MaxMindController',
        ['$scope', 'Account', 'localization', 'requestContext', 'notification', 'MaxMind', '$q',
            function ($scope, Account, localization, requestContext, notification, MaxMind, $q) {
            requestContext.setUpRenderContext('signup.maxmind', $scope);
            localization.bind('signup', $scope);

            $scope.account = null;

            $scope.callInProgress = false;

            $scope.pin = null;

            $scope.countryCodes = null;
            $scope.selectedCountryCode = '1'; // default to USA
            $scope.phone = null;

            $scope.setAccount = function() {
                $q.when(Account.getAccount(true), function (account) {
                    $scope.account = account;
                    account.country = $scope.isoToObj(account.country);
                    if ($scope.account.phone) {
                        $scope.phone = $scope.account.phone;
                    }
                });
            };

            $scope.setAccount();

            $scope.isoToObj = function(iso) {
                if(!$scope.countryCodes){
                    return;
                }
                var selected = null;
                var usa = null;
                $scope.countryCodes.some(function (el) {
                    if(el.iso3 === 'USA') {
                        usa = el;
                    }
                    if(el.iso3 === iso) {
                        selected = el;
                        return true;
                    }
                });
                return selected || usa;
            };

            MaxMind.getCountries().success(function (data) {
                $scope.countryCodes = data;
            });

            $scope.$watch('account.country', function(newVal) {
                $scope.selectedCountryCode = (newVal && newVal.areaCode) || '1';
            });

            $scope.makeCall = function() {
                $scope.account.phone = $scope.account.phone.replace(new RegExp(/[^0-9#\*]/g), '');
                MaxMind.makeCall($scope.selectedCountryCode + $scope.account.phone).success(function (data) {
                    $scope.callInProgress = data.success;
                    if (!data.success) {
                        notification.push(null, { type: 'error' }, data.message);
                    }
                });
            };

            $scope.verifyPin = function () {
                MaxMind.verify($scope.pin).success(function (data) {
                    var verified = data.success;
                    if (verified) {
                        Account.updateAccount({
                            country: $scope.account.country.iso3,
                            phone: $scope.account.phone
                        }).then(function(newAcc) {
                            $scope.nextStep();
                        });
                    } else {
                        notification.push(null, { type: 'error' },
                            localization.translate($scope, null,
                                'Phone verification failed. Incorrect PIN code. Please try again'
                            )
                        );
                    }
                });
            };
        }]);
}(window.JP.getModule('Signup')));