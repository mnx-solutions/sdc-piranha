'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        routeProvider.when('/compute', {
            title: 'Compute',
            action: 'machine.index'
        }).when('/compute/instance/:machineid', {
            title: 'Instance Details',
            action: 'machine.details',
            showLatest: true,
            showText: true,
            resolve: {
                data: ['$route', '$location', function ($route, $location) {
                    if (!$route.current.params.machineid) {
                        $location.path('/dashboard');
                    }
                }]
            }
        }).when('/compute/create/simple', {
            title: 'Quick Start: Create Instance',
            action: 'machine.simple'
        }).when('/compute/ssh', {
            title: 'SSH keys',
            action: 'machine.ssh'
        }).when('/compute/create', {
            title: 'Create Instance',
            action: 'machine.provision'
        }).when('/compute/create/recent', {
            title: 'Create Instance',
            action: 'machine.recent'
        }).when('/compute/create/:imageid', {
            title: 'Create Instance from custom image',
            action: 'machine.provision'
        }).when('/images', {
            title: 'Images',
            action: 'machine.images'
        });
    }
]);