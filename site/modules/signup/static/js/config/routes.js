'use strict';

window.JP.main.config(['$routeProvider', function ($routeProvider) {
        $routeProvider
            .when('/start', {
                action: 'signup.index'
            })
            .when('/phone', {
                action: 'signup.phone'
            })
            .when('/accountInfo', {
                action: 'signup.accountInfo'
            })
            .when('/billing', {
                action: 'signup.billing'
            })
            .when('/ssh', {
                action: 'signup.ssh'
            });
    }]);