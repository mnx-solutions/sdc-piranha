'use strict';

(function (app) {
    app.controller(
        'PhoneController',
        ['$scope', 'Account', 'localization', 'requestContext', 'notification', 'Phone', '$q',
            function ($scope, Account, localization, requestContext, notification, Phone, $q) {
            requestContext.setUpRenderContext('signup.phone', $scope);
            localization.bind('signup', $scope);

            $scope.pin = null;

            $scope.countryCodes = null;
            $scope.country = null;
            $scope.phone = null;

            $scope.selectedCountryCode = '1';

            $scope.verified = false;

            $q.when(Account.getAccount(true), function (account) {
                if (!$scope.phone) {
                    $scope.phone = account.phone || '';
                }
                if (!$scope.country || $scope.country.iso3 === 'USA') {
                    $scope.country = $scope.isoToObj(account.country);
                }
            });

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

            Phone.getCountries(function (err, countries) {
                if (err) {
                    notification.replace('phone', { type: 'error' }, err);
                    return;
                }
                $scope.countryCodes = countries;
                $scope.country = $scope.isoToObj();
            });

            $scope.$watch('country', function(newVal) {
                $scope.selectedCountryCode = (newVal && newVal.areaCode) || '';
            });

            $scope.makeCall = function() {
                if (!$scope.selectedCountryCode) {
                    return;
                }
                $scope.phone = $scope.phone.replace(new RegExp(/[^0-9#\*]/g), '');

                Phone.makeCall($scope.selectedCountryCode + $scope.phone, function (err, data) {
                    if (err) {
                        notification.replace('phone', { type: 'error' }, err);
                        return;
                    }
                    if (data.skip) {
                        notification.dismiss('phone');
                        $scope.nextStep();
                    } else {
                        notification.replace('phone', { type: 'success' }, data.message);
                    }
                });
            };

            $scope.verifyPin = function () {
                if (!$scope.pin) {
                    return;
                }
                Phone.verify($scope.pin, function (err, data) {
                    if (err) {
                        notification.replace('phone', { type: 'error' }, err);
                        return;
                    }
                    if (!$scope.verified) {
                        $scope.verified = true;
                        Account.updateAccount({
                            country: $scope.country.iso3,
                            phone: $scope.phone
                        }).then(function () {
                            notification.dismiss('phone');
                            $scope.nextStep();
                        });
                    }
                });
            };
        }]);
}(window.JP.getModule('Signup')));