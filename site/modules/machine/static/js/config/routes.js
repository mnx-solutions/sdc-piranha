'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        routeProvider.when('/compute', {
            title: 'Compute',
            action: 'machine.index'
        }).when('/compute/instance/:machineid', {
            title: 'Instance Details',
            action: 'machine.details'
        }).when('/compute/create', {
            title: 'Create Instance',
            action: 'machine.provision'
        }).when('/compute/create/:imageid', {
            title: 'Create Instance',
            action: 'machine.provision'
        }).when('/images', {
            title: 'Image List',
            action: 'machine.images'
        });
    }
]);