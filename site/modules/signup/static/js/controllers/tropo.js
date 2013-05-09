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
            $scope.randomNumber = data.randomNumber;
            var interval = setInterval(function() {
              $scope.tropoPoll++;
              $http.get('/tropo/tropo/status/'+ data.tropoId).success(function(data) {
                console.log(data);
                if(data.status === 'passed') {
                  clearInterval(interval);
                  $scope.nextStep();
                }

                if(data.status === 'failed') {
                  // TODO: Fail handling
                  clearInterval(interval);
                }

                if($scope.tropoPoll == 60) {
                  clearInterval(interval);
                }
              });
            }, 1000);
          })
        }

      })


    }]);
}(window.JP.getModule('Signup')));