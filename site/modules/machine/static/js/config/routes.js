'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        routeProvider.when('/machine', {
            title: 'Compute',
            action: 'machine.index'
        }).when('/machine/details/:machineid', {
            title: 'Instance Details',
            action: 'machine.details'
        }).when('/machine/add', {
            title: 'Create Instance',
            action: 'machine.provision'
        });
    }]);

window.JP.main.run(['Menu', function (Menu) {
        // Menu.register({
        //     name: 'Compute',
        //     link: 'machine'
        // });
    }]);
