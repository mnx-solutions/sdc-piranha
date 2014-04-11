'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    routeProvider
        .when('/utilization/:year/:month', {
            title: 'Usage',
            action: 'utilization.index'
        })
        .when('/utilization/:type/:year/:month', {
            title: 'Usage Details',
            action: 'utilization.details'
        });
}]);
