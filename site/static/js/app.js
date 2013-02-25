'use strict';

var MODULES = ['ngResource', 'http-auth-interceptor'];

// Declare app level module which depends on resource and auth-interceptor
var JoyentPortal = angular.module('JoyentPortal', MODULES);

JoyentPortal.config(['$locationProvider', function($location) {
    $location.hashPrefix('!');
  }]);