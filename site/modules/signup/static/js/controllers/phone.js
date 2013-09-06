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

            $q.when(Account.getAccount(true), function (account) {
                $scope.account = account;
                account.country = $scope.isoToObj(account.country);
                if ($scope.account.phone) {
                    $scope.phone = $scope.account.phone;
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
            });

            $scope.$watch('account.country', function(newVal) {
                $scope.selectedCountryCode = (newVal && newVal.areaCode) || '';
            });

            $scope.makeCall = function() {
                $scope.account.phone = $scope.account.phone.replace(new RegExp(/[^0-9#\*]/g), '');

                Phone.makeCall($scope.selectedCountryCode + $scope.account.phone, function (err, data) {
                    if (err) {
                        notification.replace('phone', { type: 'error' }, err);
                        $scope.callInProgress = false;
                        return;
                    }
                    $scope.callInProgress = true;
                    if (data.skip) {
                        notification.dismiss('phone');
                        $scope.nextStep();
                    } else {
                        notification.replace('phone', { type: 'success' }, data.message);
                    }
                });
            };

            $scope.verifyPin = function () {
                Phone.verify($scope.pin, function (err, data) {
                    if (err) {
                        $scope.callInProgress = false;
                        notification.replace('phone', { type: 'error' }, err);
                        return;
                    }
                    Account.updateAccount({
                        country: $scope.account.country.iso3,
                        phone: $scope.account.phone
                    }).then(function(newAcc) {
                        $scope.nextStep();
                    });
                });
            };
        }]);
}(window.JP.getModule('Signup')));