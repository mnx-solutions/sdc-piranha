'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    routeProvider
        .when('/account', {
            title: 'Account',
            action: 'account.index'
        })
        .when('/account/edit', {
            title: 'Edit Profile',
            action: 'account.edit'
        })
        .when('/account/ssh', {
            title: 'SSH keys',
            action: 'account.ssh'
        })
        .when('/account/payment', {
            title: 'Edit Billing Information',
            action: 'account.payment'
        });
    var features = window.JP.get('features');
    if (features && features.invoices !== 'disabled') {
        routeProvider.when('/account/invoices', {
            title: 'Invoices',
            action: 'account.invoices'
        });
    }
}]);