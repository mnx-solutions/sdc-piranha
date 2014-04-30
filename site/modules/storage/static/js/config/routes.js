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
        .when('/manta/builder', {
            title: 'Job builder',
            action: 'storage.builder'
        })
        .when('/manta/jobs/:jobid', {
            title: 'Job History',
            action: 'storage.job',
            showLatest: true
        });
}]);