'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    routeProvider
        .when('/cloudAnalytics/:machineid', {
            title: 'Instance Analytics',
            action: 'cloudAnalytics.index',
            parent: 'machine.details'
        })
        .when('/cloudAnalytics', {
            title: 'Cloud Analytics',
            action: 'cloudAnalytics.index'
        });
}]);