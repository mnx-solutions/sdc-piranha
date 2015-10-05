'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    var features = window.JP.get('features');
    if (!features || features.manta === 'disabled' && features.fileStorage === 'disabled') {
        return;
    } else if (features.fileStorage === 'enabled') {
        routeProvider
            .when('/manta/files', {
                title: 'File Manager',
                action: 'storage.fileman'
            });
    } else if (features.manta === 'enabled') {
        routeProvider
            .when('/manta/intro', {
                title: 'Storage',
                action: 'storage.index'
            })
            .when('/manta/files', {
                title: 'File Manager',
                action: 'storage.fileman'
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
    }

}]);