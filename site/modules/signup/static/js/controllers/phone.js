'use strict';

(function (app) {
    app.controller(
        'PhoneController',
        ['$scope', 'Account', 'localization', 'requestContext', 'notification', 'Phone', '$q',
            function ($scope, Account, localization, requestContext, notification, Phone, $q) {
            requestContext.setUpRenderContext('signup.phone', $scope);
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

            Phone.getCountries().success(function (data) {
                $scope.countryCodes = data;
            });

            $scope.$watch('account.country', function(newVal) {
                $scope.selectedCountryCode = (newVal && newVal.areaCode) || '';
            });

            $scope.makeCall = function() {
                $scope.account.phone = $scope.account.phone.replace(new RegExp(/[^0-9#\*]/g), '');
                Phone.makeCall($scope.selectedCountryCode + $scope.account.phone).success(function (data) {
                    $scope.callInProgress = data.success;
                    if (!data.success) {
                        notification.dismiss('phone');
                        notification.push('phone', { type: 'error' }, data.message);
                    } else if (data.skip) {
                        notification.dismiss('phone');
                        $scope.nextStep();
                    }
                });
            };

            $scope.verifyPin = function () {
                Phone.verify($scope.pin).success(function (data) {
                    var verified = data.success;
                    if (verified) {
                        Account.updateAccount({
                            country: $scope.account.country.iso3,
                            phone: $scope.account.phone
                        }).then(function(newAcc) {
                            $scope.nextStep();
                        });
                    } else {
                        $scope.callInProgress = false;
                        notification.dismiss('phone');
                        notification.push('phone', { type: 'error' }, data.message);
                    }
                });
            };
        }]);
}(window.JP.getModule('Signup')));