'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    routeProvider
        .when('/storage', {
            title: 'Storage',
            action: 'storage.index'
        })
        .when('/storage/history', {
            title: 'Storage',
            action: 'storage.history'
        })
        .when('/storage/job/:jobid', {
            title: 'Job details',
            action: 'storage.job'
        });
}]);