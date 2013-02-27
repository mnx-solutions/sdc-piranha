'use strict';

window.JP.setMain('JoyentPortal', ['ngResource', 'http-auth-interceptor']);

window.JP.main.config(['$locationProvider', function ($location) {
    $location.hashPrefix('!');
}]);