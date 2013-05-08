'use strict';

window.JP.main.config(['$routeProvider', function ($routeProvider) {
        $routeProvider
            .when('/start', {
                action: 'signup.index'
            })
            .when('/accountInfo', {
                action: 'signup.accountInfo'
            })
            .when('/tropo', {
                action: 'signup.tropo'
            })
            .when('/billing', {
                action: 'signup.billing'
            })
            .when('/ssh', {
                action: 'signup.ssh'
            });
    }]);