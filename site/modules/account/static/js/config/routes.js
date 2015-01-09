'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    var masterUserResolve = {
        data: ['Account', '$location', '$rootScope', function (Account, $location, $rootScope) {
            Account.getAccount().then(function (account) {
                if (account.isSubuser || $rootScope.features.billing === 'disabled') {
                    $location.path('/dashboard');
                }
            });
        }]
    };

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
            action: 'account.ssh',
            resolve: masterUserResolve
        })
        .when('/account/payment', {
            title: 'Edit Billing Information',
            action: 'account.payment',
            resolve: masterUserResolve
        });
    var features = window.JP.get('features');
    if (features && features.invoices !== 'disabled') {
        routeProvider.when('/account/invoices', {
            title: 'Invoices',
            action: 'account.invoices',
            resolve: masterUserResolve
        });
    }
}]);