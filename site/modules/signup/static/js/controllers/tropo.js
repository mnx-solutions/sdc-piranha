'use strict';

(function (app) {
    app.controller(
        'TropoController',
        ['$scope', 'Account', 'localization', 'requestContext', '$http', '$q', function ($scope, Account, localization, requestContext, $http, $q) {
            requestContext.setUpRenderContext('signup.tropo', $scope);
            localization.bind('signup', $scope);

            $scope.randomNumber = 'XXXX';

            $scope.account = null;

            $scope.tropoRunning = false;
            $scope.tropoPoll = 0;
            $scope.retriesLeft = 3;

            $scope.countryCodes = null;
            $scope.selectedCountryCode = null; // default to USA
            $scope.phone = null;

            $scope.setAccount = function() {
                $q.when(Account.getAccount(true), function (account) {
                    $scope.account = account;

                    if(!account.country) {
                        account.country = 'United States';
                    }

                    $http.get('/signup/account/tropoRetries/'+ account.id).success(function(data) {

                        if(data.retries && data.retries != null) {
                            $scope.retriesLeft = (3-data.retries);
                        }

                        if($scope.retriesLeft <= 0) {
                            $scope.error = 'Phone verification failed. Please contact support in order to activate your account';
                        }
                    });

                    if ($scope.account.phone) {
                        var phoneSplit = $scope.account.phone.split('-');
                        $scope.selectedCountryCode = phoneSplit[0];
                        $scope.phone = phoneSplit[1];
                    }
                });
            };

            $scope.setAccount();

            $scope.nameToCode = function(countryName) {
                if(!$scope.countryCodes)
                    return;

                for(var country in $scope.countryCodes.codes){
                    if($scope.countryCodes.codes[country].name === countryName) {
                        return $scope.countryCodes.codes[country].areaCode;
                    }
                }
            }

            $http.get('account/countryCodes').success(function (data) {
                $scope.countryCodes = data;
            });

            $scope.$watch('account.country', function(newVal, oldVal) {
                if(newVal)
                    newVal = $scope.nameToCode(newVal);

                if(newVal != oldVal) {
                    $scope.selectedCountryCode = newVal;
                }
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
                $scope.phoneVerification($scope.account);
            };

            $scope.phoneVerification = function(account) {
                if(!$scope.tropoRunning && $scope.currentStep === 'tropo') {
                    $scope.tropoRunning = true;
                    $http.get('/tropo/tropo/'+ $scope.nameToCode($scope.account.country) + $scope.account.phone +'/'+ account.id).success(function(data) {
                        if(data.retries) {
                            $scope.retriesLeft = (3-data.retries);
                        }

                        if(!data.success) {
                            $scope.error = 'Phone verification failed. Please contact support in order to activate your account';
                            $scope.tropoRunning = false;
                            $scope.retriesLeft = 0;
                        } else {
                            $scope.randomNumber = data.randomNumber;

                            var interval = setInterval(function() {
                                $scope.tropoPoll++;
                                $http.get('account/tropo/'+ data.tropoId +'/'+ account.id).success(function(data) {
                                    $scope.retriesLeft = (3-data.retries);

                                    if(data.status === 'passed') {

                                        $scope.deleteInterval(interval);

                                        // update account phone and country
                                        Account.updateAccount($scope.account).then(function(newAcc) {
                                            $scope.nextStep();
                                        });
                                    }

                                    if(data.status === 'failed') {
                                        // TODO: Fail handling


                                        $scope.deleteInterval(interval);

                                        if($scope.retriesLeft <= 0)
                                            $scope.error = 'Phone verification failed. Please contact support in order to activate your account';
                                        else
                                            $scope.error = 'Phone verification failed. Please check the number and try again';
                                    }

                                    if($scope.tropoPoll == 60) {
                                        $scope.deleteInterval(interval);

                                        $scope.error = 'Phone verification failed. Please check the number and try again';
                                    }
                                });
                            }, 1000);
                        }
                    });
                }
            };


        }]);
}(window.JP.getModule('Signup')));