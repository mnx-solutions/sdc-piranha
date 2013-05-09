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

      $scope.account.then(function(account) {

        if(!$scope.tropoRunning && $scope.currentStep === 'tropo') {
          $http.get('/tropo/tropo/'+ account['phone']).success(function(data) {
            if(!data.success) {
              $scope.error = 'Phone verification failed. Please contact support in order to activate your account';
            } else {
              $scope.randomNumber = data.randomNumber;

              var interval = setInterval(function() {
                $scope.tropoPoll++;
                $http.get('/tropo/tropo/status/'+ data.tropoId).success(function(data) {
                  if(data.status === 'passed') {
                    clearInterval(interval);
                    $scope.nextStep();
                  }

                  if(data.status === 'failed') {
                    // TODO: Fail handling
                    clearInterval(interval);
                    $scope.error = 'Phone verification failed. Please contact support in order to activate your account';
                  }

                  if($scope.tropoPoll == 60) {
                    clearInterval(interval);
                    $scope.error = 'Phone verification failed. Please contact support in order to activate your account';
                  }
                });
              }, 1000);
            }
          });
        }

      });


    }]);
}(window.JP.getModule('Signup')));