'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    routeProvider
        .when('/manta/intro', {
            title: 'Storage',
            action: 'storage.index'
        })
        .when('/manta/jobs', {
            title: 'Storage',
            action: 'storage.history'
        })
        .when('/manta/jobs/:jobid', {
            title: 'Job details',
            action: 'storage.job'
        });
}]);