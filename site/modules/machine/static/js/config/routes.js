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
            resolve: {
                data: ['$route', '$location', function ($route, $location) {
                    if (!$route.current.params.machineid) {
                        $location.path('/dashboard');
                    }
                }]
            }
        }).when('/compute/create/simple', {
            title: 'Simple Create Instance',
            action: 'machine.simple'
        }).when('/compute/create', {
            title: 'Create Instance',
            action: 'machine.provision'
        }).when('/compute/create/:imageid', {
            title: 'Create Instance For Image',
            action: 'machine.provision'
        }).when('/images', {
            title: 'Image List',
            action: 'machine.images'
        });
    }
]);