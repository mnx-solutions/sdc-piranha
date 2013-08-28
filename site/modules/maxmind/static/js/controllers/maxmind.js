'use strict';

(function (app) {
    app.controller(
        'MaxMind.IndexController',
        ['$scope', 'Account', 'localization', 'requestContext', '$http', '$q', function ($scope, Account, localization, requestContext, $http, $q) {
            requestContext.setUpRenderContext('maxmind.index', $scope);
            localization.bind('signup', $scope);

            var errSupport = 'Phone verification failed. Please contact <a class="support" href="https://help.joyent.com">support</a> in order to activate your account';
            var errTry = 'Phone verification failed. Please check the number and try again';

            $scope.randomNumber = 'XXXX';

            $scope.account = null;

            $scope.tropoRunning = false;
            $scope.tropoPoll = 0;
            $scope.retriesLeft = 3;

            $scope.countryCodes = null;
            $scope.selectedCountryCode = '1'; // default to USA
            $scope.phone = null;

            $scope.setAccount = function() {
                $q.when(Account.getAccount(true), function (account) {
                    $scope.account = account;

                    account.country = $scope.isoToObj(account.country);

                    $http.get('/signup/account/tropoRetries/'+ account.id).success(function(data) {
                        if(data.retries && data.retries !== null) {
                            $scope.retriesLeft = (3-data.retries);
                        }

                        if($scope.retriesLeft <= 0) {
                            $scope.error = errSupport;
                        }
                    });

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

            $scope.filterUndefinedAreas = function (country) {
                return !!country.areaCode;
            };

            $scope.deleteInterval = function(interval) {
                $scope.tropoPoll = 0;
                $scope.tropoRunning = false;
                clearInterval(interval);
            };

            $scope.makeCall = function() {
                $scope.phoneVerification();
            };

            $scope.phoneVerification = function() {
                // clean the phone number
                $scope.account.phone = $scope.account.phone.replace(new RegExp(/[^0-9#\*]/g), '');

                if(!$scope.tropoRunning && $scope.currentStep === 'tropo') {
                    $scope.tropoRunning = true;
                    $http.get('/tropo/tropo/'+ $scope.selectedCountryCode + $scope.account.phone +'/'+ $scope.account.id).success(function(data) {
                        if(data.retries) {
                            $scope.retriesLeft = (3-data.retries);
                        }

                        if(!data.success) {
                            $scope.error = errSupport;
                            $scope.tropoRunning = false;
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
                                        // TODO: Fail handling
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
            };


        }]);
}(window.JP.getModule('MaxMind')));