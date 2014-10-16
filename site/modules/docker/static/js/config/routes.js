'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    var features = window.JP.get('features');
    if (features && features.docker !== 'enabled') {
        return;
    }
    routeProvider
        .when('/docker', {
            title: 'Docker',
            action: 'docker.index'
        }).when('/docker/registries', {
            title: 'Registries',
            action: 'docker.registries'
        }).when('/docker/registry/:id', {
            title: 'Registry',
            action: 'docker.registry'
        }).when('/docker/containers', {
            title: 'Containers',
            action: 'docker.containers'
        }).when('/docker/container/:hostid/:containerid', {
            title: 'Container Details',
            action: 'docker.details',
            showLatest: true,
            showText: true,
            resolve: {
                data: ['$route', '$location', function ($route, $location) {
                    if (!$route.current.params.containerid || !$route.current.params.hostid) {
                        $location.path('/dashboard');
                    }
                }]
            }
        }).when('/docker/container/create', {
            title: 'Create Container',
            action: 'docker.create'
        }).when('/docker/images', {
            title: 'Images',
            action: 'docker.images'
        }).when('/docker/image/create', {
            title: 'Create Image',
            action: 'docker.create'
        }).when('/docker/image/:hostid/:imageid', {
            title: 'Image Details',
            action: 'docker.image-details',
            showLatest: true,
            showText: true,
            resolve: {
                data: ['$route', '$location', function ($route, $location) {
                    if (!$route.current.params.imageid || !$route.current.params.hostid) {
                        $location.path('/dashboard');
                    }
                }]
            }
        }).when('/docker/logs', {
            title: 'Log Management',
            action: 'docker.logManagement'
        }).when('/docker/analytics', {
            title: 'Analytics',
            action: 'docker.analytics'
        });
}]);
