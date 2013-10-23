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
            $scope.fullPhoneNumber = null;

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
                Account.getAccount(true).then(function (account) {
                    if (!$scope.phone) {
                        $scope.phone = account.phone || '';
                    }
                    if (!$scope.country || $scope.country.iso3 === 'USA') {
                        $scope.country = $scope.isoToObj(account.country);
                    }
                });
            });

            $scope.$watch('phone', function (newVal) {
                $scope.phone = newVal ? newVal.replace(new RegExp(/[^0-9#\*]/g), '') : newVal;
                $scope.fullPhoneNumber = $scope.selectedCountryCode + $scope.phone;
                if ($scope.fullPhoneNumber !== $scope.lastCalledNumber) {
                    $scope.callInProgress = false;
                }
            });

            $scope.$watch('country', function(newVal) {
                $scope.selectedCountryCode = (newVal && newVal.areaCode) || '';
                $scope.fullPhoneNumber = $scope.selectedCountryCode + $scope.phone;
                if ($scope.fullPhoneNumber !== $scope.lastCalledNumber) {
                    $scope.callInProgress = false;
                }
            });

            $scope.makeCall = function() {
                if (!$scope.fullPhoneNumber || $scope.callInProgress) {
                    return;
                }
                $scope.callInProgress = true;
                $scope.lastCalledNumber = $scope.fullPhoneNumber;
                Phone.makeCall($scope.fullPhoneNumber, function (err, data) {
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
                        // maybe display 'calling...' message somewhere
                    }
                });
            };

            $scope.verifyPin = function () {
                if (!$scope.pin) {
                    return;
                }
                $scope.callInProgress = false;
                Phone.verify($scope.pin, function (err, data) {
                    if (err) {
                        $scope.pinError = err;
                        if (data.navigate) {
                            $scope.updateStep();
                        }
                        return;
                    }
                    Account.updateAccount({
                        country: $scope.country.iso3,
                        phone: $scope.phone
                    }).then(function () {
                        $scope.pinError = null;
                        $scope.updateStep();
                    });
                });
            };
        }]);
}(window.JP.getModule('Signup')));
