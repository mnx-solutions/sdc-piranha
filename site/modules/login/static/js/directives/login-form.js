(function(ng, app) {
  'use strict';

  app.directive('loginForm', function() {
    return {
      restrict: 'C',
      template: '<div class="container">' +
	      '<form class="form-signin" name="login" data-ng-controller="LoginFormController">' +
	      '<h2 class="form-signin-heading">Please sign in</h2>' +
	      '<input type="email" class="input-block-level" placeholder="Email address" data-ng-model="login.email" required>' +
	      '<input type="password" class="input-block-level" placeholder="Password" data-ng-model="login.password" required>' +
	      '<label class="checkbox">' +
	      '<input type="checkbox" data-ng-model="remember" value="remember-me"> Remember me' +
	      '</label>' +
	      '<a data-ng-click="cancelLogin()">Cancel</a>' +
	      '<button class="btn btn-large btn-primary" data-ng-click="logIn()">Sign in</button>' +
	      '</form>' +
	      '</div>',
      link: function(scope, elem, attrs) {

      }
    };
  });
})(window.angular, window.LoginModule);