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

        $scope.countries = null;
        $scope.countryCodes = null;
        $scope.stateSel = null;
        $scope.selectedCountryCode = null;
        $scope.phone = null;
        $scope.tropoPhone = null;

        $scope.setAccount = function() {
            $q.when(Account.getAccount(true), function (account) {
                $scope.account = account;

                $http.get('/signup/account/tropoRetries/'+ account.id).success(function(data) {
                    $scope.retriesLeft = (3-data.retries);
                    $scope.error = 'Phone verification failed. Please contact support in order to activate your account';
                });

                if($scope.account.phone) {
                    var phoneSplit = $scope.account.phone.split('-');
                    $scope.selectedCountryCode = phoneSplit[0];
                    $scope.phone = phoneSplit[1];
                }
            });
        };

        $scope.setAccount();

        $http.get('billing/countries').success(function (data) {
            $scope.countries = data;
        });

        $http.get('account/countryCodes').success(function (data) {
            $scope.countryCodes = data;
        });

        $scope.filterUndefinedAreas = function (country) {
            return !!country.areaCode;
        };

        /* phone number handling */
        $scope.$watch('phone', function(newVal, oldVal) {
            if(oldVal !== newVal) {
                $scope.tropoPhone = $scope.selectedCountryCode +'-'+ newVal;
            }
            }, true);

            $scope.$watch('selectedCountryCode', function(newVal, oldVal) {
            if(oldVal !== newVal) {
                $scope.tropoPhone = newVal +'-'+ $scope.phone;
            }
//            if(!newVal) {
//                $scope.countryStyle.width = '100px';
//            } else {
//                var width = '';
//                switch((newVal + '').length){
//                    case 3:
//                        width = '50px';
//                        break;
//                    case 2:
//                        width = '58px';
//                        break;
//                    case 1:
//                        width = '66px';
//                        break;
//                }
//                $scope.countryStyle.width = width;
//            }
        }, true);

      $scope.deleteInterval = function(interval) {
            $scope.tropoPoll = 0;
            $scope.tropoRunning = false;
            clearInterval(interval);
      };

      $scope.makeCall = function() {
          $scope.phoneVerification($scope.account);
      }

      $scope.phoneVerification = function(account) {
          var dialNumber = $scope.tropoPhone;
          if(!$scope.tropoRunning && $scope.currentStep === 'tropo' && $scope.retriesLeft < 3) {
              $scope.tropoRunning = true;
              $http.get('/tropo/tropo/'+ dialNumber.replace('-', '') +'/'+ account.id).success(function(data) {
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

                                  // update account phone
                                  $scope.account.phone = dialNumber;
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