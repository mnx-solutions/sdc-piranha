'use strict';

(function (app) {
    app.controller(
        'MaxMind.IndexController',
        ['$scope', 'Account', 'localization', 'requestContext', '$http', '$q', function ($scope, Account, localization, requestContext, $http, $q) {
            requestContext.setUpRenderContext('maxmind.index', $scope);
            localization.bind('maxmind', $scope);

            var errSupport = 'Phone verification failed. Incorrect PIN code. Your account has been locked. Please contact support';
            var errTry = 'Phone verification failed. Incorrect PIN code. Please try again';

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

            $http.get('account/countryCodes').success(function (data) {
                $scope.countryCodes = data;
            });

            $scope.$watch('account.country', function(newVal) {
                $scope.selectedCountryCode = (newVal && newVal.areaCode) || '1';
            });

            $scope.makeCall = function() {
                $scope.account.phone = $scope.account.phone.replace(new RegExp(/[^0-9#\*]/g), '');
                $http.get('/main/maxmind/call/%2B' + $scope.selectedCountryCode + $scope.account.phone).success(function (data) {
                    $scope.callInProgress = data.success;
                });
            };

            $scope.verifyPin = function () {
                $http.get('/main/maxmind/verify/' + $scope.pin).success(function (data) {
                    var verified = data.success;
                });
            };

            /*$scope.phoneVerification = function() {
                $scope.account.phone = $scope.account.phone.replace(new RegExp(/[^0-9#\*]/g), '');

                if(!$scope.callInProgress && $scope.currentStep === 'tropo') {
                    $scope.callInProgress = true;
                    $http.get('/tropo/tropo/'+ $scope.selectedCountryCode + $scope.account.phone +'/'+ $scope.account.id).success(function(data) {
                        if(data.retries) {
                            $scope.retriesLeft = (3-data.retries);
                        }

                        if(!data.success) {
                            $scope.error = errSupport;
                            $scope.callInProgress = false;
                            $scope.retriesLeft = 0;
                        } else {
                            $scope.randomNumber = data.randomNumber;

                            var interval = setInterval(function() {
                                $scope.tropoPoll++;
                                $http.get('account/tropo/'+ data.tropoId +'/'+ $scope.account.id).success(function(data) {
                                    $scope.retriesLeft = (3-data.retries);

                                    if(data.status === 'passed') {

                                        $scope.deleteInterval(interval);

                                        // update account phone and country
                                        Account.updateAccount({
                                            country: $scope.account.country.iso3,
                                            phone: $scope.account.phone
                                        }).then(function(newAcc) {
                                                $scope.nextStep();
                                            });
                                    }

                                    if(data.status === 'failed') {
                                        $scope.deleteInterval(interval);

                                        $scope.error = $scope.retriesLeft <= 0 ? errSupport : errTry;
                                    }

                                    if(+$scope.tropoPoll === 60) {
                                        $scope.deleteInterval(interval);

                                        $scope.error = errTry;
                                    }
                                });
                            }, 1000);
                        }
                    });
                }
            };*/


        }]);
}(window.JP.getModule('MaxMind')));