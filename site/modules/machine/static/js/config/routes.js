'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        routeProvider.when('/compute', {
            title: 'Compute',
            action: 'machine.index'
        }).when('/compute/combined-instances', {
            title: 'Compute',
            action: 'machine.combined-instances',
            resolve: {
                data: ['$rootScope', '$location', function ($rootScope, $location) {
                    if ($rootScope.features.combinedInstances === 'disabled') {
                        $location.path('/compute');
                    }
                }]
            }
        }).when('/compute/intro', {
            title: 'Compute',
            action: 'machine.introduction'
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
            action: 'machine.provision'
        }).when('/compute/ssh', {
            title: 'SSH keys',
            action: 'machine.ssh'
        }).when('/compute/create/native-container', {
            title: 'Create Instance',
            action: 'machine.provision'
        }).when('/compute/create/virtual-machine', {
            title: 'Create Instance',
            action: 'machine.provision'
        }).when('/compute/container/create', {
            title: 'Create Container',
            action: 'machine.provision'
        }).when('/compute/create/:imageid', {
            title: 'Create Instance from custom image',
            action: 'machine.provision'
        }).when('/images', {
            title: 'Images',
            action: 'machine.images',
            resolve: {
                data: ['$rootScope', '$location', function ($rootScope, $location) {
                    if ($rootScope.features.imageUse === 'disabled') {
                        $location.path('/dashboard');
                    }
                }]
            }
        }).when('/images/:currentImage', {
            title: 'Image Details',
            action: 'machine.image-details',
            showLatest: true,
            showText: true,
            resolve: {
                data: ['$rootScope', '$route', '$location', function ($rootScope, $route, $location) {
                    if ($route.current && $route.current.params && !$route.current.params.currentImage ||
                        $rootScope.features.imageUse === 'disabled') {
                        $location.path('/dashboard');
                    }
                }]
            }
        });
    }
]);