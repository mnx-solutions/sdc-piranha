'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    routeProvider
        .when('/account', {
            title: 'Account',
            action: 'account.index'
        })
        .when('/account/payment', {
            title: 'Payment info',
            action: 'account.payment'
        });
}]);

window.JP.main.run(['Menu', function (Menu) {
    Menu.register({
        name: 'Account',
        link: 'account'
    });
}]);