'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    routeProvider
        .when('/account', {
            title: 'Account',
            action: 'account.index'
        })
        .when('/account/edit', {
            title: 'Edit account',
            action: 'account.edit'
        })
        .when('/account/ssh', {
            title: 'SSH keys',
            action: 'account.ssh'
        })
        .when('/account/payment', {
            title: 'Payment information',
            action: 'account.payment'
        })
        .when('/account/invoices', {
            title: 'Invoices',
            action: 'account.invoices'
        });
}]);

window.JP.main.run(['Menu', function (Menu) {
    Menu.register({
        name: 'Account',
        link: 'account'
    });
}]);