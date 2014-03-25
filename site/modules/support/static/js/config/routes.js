'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    routeProvider
        .when('/support', {
            title: 'Support',
            action: 'support.more'
        })
        .when('/support/:link', {
            title: 'Cloud Node.js',
            action: 'support.index'
        });
}]);
