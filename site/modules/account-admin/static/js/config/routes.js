'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        routeProvider.when('/account', {
            title: 'Account',
            action: 'account-admin.index'
        }).when('/account/:id', {
            title: 'Account edit',
            action: 'account-admin.edit'
        });
    }]);

window.JP.main.run(['Menu', function (Menu) {
    }]);
