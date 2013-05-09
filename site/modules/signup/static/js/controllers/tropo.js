'use strict';

(function (app) {
  app.controller(
    'TropoController',
    ['$scope', 'Account', 'localization', 'requestContext', '$http', function ($scope, Account, localization, requestContext, $http) {
      requestContext.setUpRenderContext('signup.tropo', $scope);
      localization.bind('signup', $scope);

      $scope.randomNumber = 'XXXX';

      $scope.account = Account.getAccount();

      $scope.account.then(function(account) {
        $http.get('/tropo/tropo/'+ account['phone']).success(function(data) {
          $scope.randomNumber = data.randomNumber;
          setInterval(function() {
            $http.get('/tropo/tropo/status/'+ data.tropoId).success(function(data) {
              console.log(data);
              if(data.status === 'PASSED') {
                $scope.nextStep();
              }
            });
          }, 1000);
        })
      })


    }]);
}(window.JP.getModule('Signup')));