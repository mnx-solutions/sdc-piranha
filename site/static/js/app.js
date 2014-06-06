'use strict';

window.JP.setMain('JoyentPortal', [
    'ngResource',
    'http-auth-interceptor',
    'ngRoute',
    'ngSanitize'
]);

window.JP.main.config(['$locationProvider', '$parseProvider', function ($locationProvider, $parseProvider) {
    $locationProvider.hashPrefix('!');
    $parseProvider.unwrapPromises(true);
    $parseProvider.logPromiseWarnings(false);
}]);