'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        routeProvider.when('/machine', {
            title: 'Machines',
            action: 'machine.index'
        }).when('/machine/details/:machineid', {
            title: 'Machine details',
            action: 'machine.details'
        }).when('/machine/add', {
            title: 'Create new machine',
            action: 'machine.provision'
        });
    }]);

window.JP.main.run(['Menu', function (Menu) {
        Menu.register({
            name: 'Compute',
            link: 'machine'
        });
    }]);
