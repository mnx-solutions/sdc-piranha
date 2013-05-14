'use strict';

(function (app) {
  app.controller(
    'TropoController',
    ['$scope', 'Account', 'localization', 'requestContext', '$http', function ($scope, Account, localization, requestContext, $http) {
      requestContext.setUpRenderContext('signup.tropo', $scope);
      localization.bind('signup', $scope);

      $scope.randomNumber = 'XXXX';

      $scope.account = Account.getAccount();

      $scope.tropoRunning = false;
      $scope.tropoPoll = 0;
      $scope.retriesLeft = 3;

      $scope.account.then(function(account) {
          $scope.phoneVerification(account);
      });

      $scope.deleteInterval = function(interval) {
            $scope.tropoPoll = 0;
            $scope.tropoRunning = 0;
            clearInterval(interval);
      };

      $scope.phoneVerification = function(account) {
          if(!$scope.tropoRunning && $scope.currentStep === 'tropo') {
              $http.get('/tropo/tropo/'+ account.phone +'/'+ account.id).success(function(data) {
                  if(data.retries) {
                      $scope.retriesLeft = (3-data.retries);
                  }

                  if(!data.success) {
                      $scope.error = 'Phone verification failed. Please contact support in order to activate your account';
                  } else {
                      $scope.randomNumber = data.randomNumber;

                      var interval = setInterval(function() {
                          $scope.tropoPoll++;
                          $http.get('account/tropo/'+ data.tropoId).success(function(data) {
                              if(data.status === 'passed') {

                                  $scope.deleteInterval(interval);
                                  $scope.nextStep();
                              }

                              if(data.status === 'failed') {
                                  // TODO: Fail handling
                                  $scope.deleteInterval(interval);


                                  $scope.error = 'Phone verification failed. Retrying... ';
                                  $scope.phoneVerification(account);

                              }

                              if($scope.tropoPoll == 60) {
                                  $scope.deleteInterval(interval);

                                  $scope.error = 'Phone verification failed. Retrying... ';
                                  $scope.phoneVerification(account);
                              }
                          });
                      }, 1000);
                  }
              });
          }
      }


    }]);
}(window.JP.getModule('Signup')));