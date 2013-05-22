'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        routeProvider.when('/accountAdmin', {
            title: 'Account',
            action: 'account-admin.index'
        }).when('/accountAdmin/:id', {
            title: 'Account edit',
            action: 'account-admin.edit'
        });
    }]);

window.JP.main.run(['Menu', function (Menu) {}]);
