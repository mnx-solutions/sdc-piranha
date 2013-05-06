'use strict';

window.JP.main.config(['$routeProvider', function ($routeProvider) {
        $routeProvider
            .when('/start', {
                action: 'signup.index'
            })
            .when('/billing', {
                action: 'signup.billing'
            })
            .when('/ssh', {
                action: 'signup.ssh'
            });
    }]);