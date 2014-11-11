'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    var features = window.JP.get('features');
    if (features && features.docker !== 'enabled') {
        return;
    }
    var dockerResolve = {
        data: ['$rootScope', '$location', '$q', 'Docker', 'Account', function ($rootScope, $location, $q, Docker, Account) {

            function changePath() {
                if ($location.path() !== '/docker' && (!$rootScope.provisionEnabled || !$rootScope.dockerHostsAvailable)) {
                    $location.path('/docker');
                }
            }

            if (typeof ($rootScope.provisionEnabled) !== 'boolean' || typeof ($rootScope.dockerHostsAvailable) !== 'boolean') {
                $q.all([
                    $q.when(Account.getAccount()),
                    $q.when(Docker.listHosts())
                ]).then(function (result) {
                    var account = result[0] || {};
                    var hosts = result[1] || [];
                    $rootScope.provisionEnabled = account.provisionEnabled || false;
                    $rootScope.dockerHostsAvailable = hosts.length > 0;
                    changePath();
                });
            } else {
                changePath();
            }
        }]
    };
    routeProvider
        .when('/docker', {
            title: 'Docker',
            action: 'docker.index',
            resolve: dockerResolve
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
