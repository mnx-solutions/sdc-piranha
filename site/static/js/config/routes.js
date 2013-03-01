'use strict';

window.JP.main.config(['$routeProvider', function ($routeProvider) {
        $routeProvider
                .when('/', {
            action: 'landing.home'
        })
                .otherwise({redirectTo: '/'});
    }]);