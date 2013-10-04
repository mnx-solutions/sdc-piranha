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
            title: 'Billing information',
            action: 'account.payment'
        });

    if(window.JP.get('features').invoices !== 'disabled') {
        routeProvider.when('/account/invoices', {
            title: 'Invoices',
            action: 'account.invoices'
        });
    }
}]);