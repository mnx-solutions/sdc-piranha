'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    routeProvider
        .when('/utilization', {
            title: 'Utilization',
            action: 'utilization.index'
        })
        .when('/utilization/spend', {
            title: 'Utilization Details Spend',
            action: 'utilization.spend'
        })
        .when('/utilization/cpu', {
            title: 'Utilization Details CPU',
            action: 'utilization.cpu'
        })
        .when('/utilization/manta', {
            title: 'Utilization Details Storage',
            action: 'utilization.manta'
        })
        .when('/utilization/bandwidth', {
            title: 'Utilization Details Bandwidth',
            action: 'utilization.bandwidth'
        });
}]);
