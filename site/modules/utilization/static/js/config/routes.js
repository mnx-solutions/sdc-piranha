'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    routeProvider
        .when('/utilization/:year/:month', {
            title: 'Utilization',
            action: 'utilization.index'
        })
        .when('/utilization/:type/:year/:month', {
            title: 'Utilization Details',
            action: 'utilization.details'
        });
}]);
