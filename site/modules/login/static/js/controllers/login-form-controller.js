'use strict';

(function(ng, app){
  app.controller(
    'LoginFormController',
    function($scope, $http, Login) {
      $scope.login = {
        email: '',
        password: '',
        remember: ''
      };
      
      $scope.logIn = function(){
        var login = new Login($scope.login);
        if(login.$valid){
          login.$save();
          console.log(login);
        } else {
          console.log('INVALID');
        }
      };
    }
  );
})(angular, JoyentPortal);
