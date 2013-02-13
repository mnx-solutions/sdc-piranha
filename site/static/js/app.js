'use strict';

// Declare app level module which depends on resource and auth-interceptor
var JoyentPortal = angular.module('JoyentPortal', [ 'ngResource', 'http-auth-interceptor' ]);

JoyentPortal.config(['$locationProvider', function($location) {
  $location.hashPrefix('!');
}]);