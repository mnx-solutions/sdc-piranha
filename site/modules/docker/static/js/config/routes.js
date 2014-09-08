'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    var features = window.JP.get('features');
    if (features && features.docker !== 'enabled') {
        return;
    }
    routeProvider
        .when('/docker', {
            title: 'Docker Dashboard',
            action: 'docker.index'
        }).when('/docker/registries', {
            title: 'Registries',
            action: 'docker.registries'
        }).when('/docker/containers', {
            title: 'Containers',
            action: 'docker.containers'
        }).when('/docker/logs', {
            title: 'Log Management',
            action: 'docker.logManagement'
        }).when('/docker/analytics', {
            title: 'Analytics',
            action: 'docker.analytics'
        });
}]);
