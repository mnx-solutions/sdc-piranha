'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    var features = window.JP.get('features');
    if (features && features.docker !== 'enabled') {
        return;
    }
    var dockerResolve = {
        data: ['$rootScope', '$location', function ($rootScope, $location) {
            if (!$rootScope.provisionEnabled || (typeof ($rootScope.dockerHostsAvailable) === 'boolean' && !$rootScope.dockerHostsAvailable)) {
                $location.path('/docker');
            }
        }]
    };
    routeProvider
        .when('/docker', {
            title: 'Docker',
            action: 'docker.index'
        }).when('/docker/registries', {
            title: 'Registries',
            action: 'docker.registries',
            resolve: dockerResolve
        }).when('/docker/registry/:id', {
            title: 'Registry',
            action: 'docker.registry',
            resolve: dockerResolve
        }).when('/docker/containers', {
            title: 'Containers',
            action: 'docker.containers',
            resolve: dockerResolve
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
        }).when('/docker/container/create/:hostid?/:sourceid?', {
            title: 'Create Container',
            action: 'docker.create',
            resolve: dockerResolve
        }).when('/docker/images', {
            title: 'Images',
            action: 'docker.images',
            resolve: dockerResolve
        }).when('/docker/image/create/:hostid?/:sourceid?', {
            title: 'Create Image',
            action: 'docker.create',
            resolve: dockerResolve
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
            action: 'docker.logManagement',
            resolve: dockerResolve
        }).when('/docker/analytics/:hostid?/:containerid?', {
            title: 'Analytics',
            action: 'docker.analytics',
            resolve: dockerResolve
        });
}]);
