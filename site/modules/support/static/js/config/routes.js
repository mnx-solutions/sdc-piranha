'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    routeProvider
        .when('/support', {
            title: 'Support',
            action: 'support.index'
        })
        .when('/support/:link', {
            title: 'Cloud Node.js',
            action: 'support.index'
        });
}]);
