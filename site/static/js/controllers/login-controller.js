'use strict';

(function(ng, app){
  app.controller(
    'LoginController',
    function($scope, $http, authService) {
      $scope.submit = function() {
        $http.get('/machine/login').success(function() {
          authService.loginConfirmed();
        });
      };
    }
  );
})(angular, JoyentPortal);
