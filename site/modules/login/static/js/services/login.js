'use strict';

(function(ng, app) {
  // I provide information about the current route request.
  app.factory('Login', ['$resource', function ($resource) {
    var Login = $resource('/login', {}, {});
    return Login;
  }]);
})(window.angular, window.JoyentPortal);