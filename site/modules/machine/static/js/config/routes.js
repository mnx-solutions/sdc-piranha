'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        routeProvider.when('/machine', {
            title: 'Instances',
            action: 'machine.index'
        }).when('/machine/details/:machineid', {
            title: 'Instance details',
            action: 'machine.details'
        }).when('/machine/add', {
            title: 'Create new instance',
            action: 'machine.provision'
        });
    }]);

window.JP.main.run(['Menu', function (Menu) {
        // Menu.register({
        //     name: 'Compute',
        //     link: 'machine'
        // });
    }]);
