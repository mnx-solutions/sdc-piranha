'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    routeProvider
        .when('/usage/:year/:month', {
            title: 'Usage',
            action: 'utilization.index'
        })
        .when('/usage/:type/:year/:month', {
            title: 'Usage Details',
            action: 'utilization.details'
        });
}]);
