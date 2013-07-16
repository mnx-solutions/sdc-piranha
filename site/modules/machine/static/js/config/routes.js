'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        routeProvider.when('/instance', {
            title: 'Compute',
            action: 'machine.index'
        }).when('/instance/details/:machineid', {
            title: 'Instance Details',
            action: 'machine.details'
        }).when('/instance/create', {
            title: 'Create Instance',
            action: 'machine.provision'
        });
    }
]);