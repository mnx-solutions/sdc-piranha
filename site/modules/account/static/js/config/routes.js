'use strict';

window.JP.main.config(['$routeProvider', function ($routeProvider) {
    $routeProvider
        .when('/account', {
            action: 'account.index'
        })
}]);

window.JP.main.run(['Menu', function (Menu) {
    Menu.register({
        name: 'Account',
        link: 'account'
    });
}]);