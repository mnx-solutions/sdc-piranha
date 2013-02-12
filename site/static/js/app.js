'use strict';

// Declare app level module which depends on filters, and services
var JoyentPortal = angular.module('JoyentPortal', [ 'ngResource', 'http-auth-interceptor' ]);

JoyentPortal.config(['$locationProvider', function($location) {
  $location.hashPrefix('!');
}]);