'use strict';

window.JP.main.config(['$routeProvider', function ($routeProvider) {
        $routeProvider
                .when('/start', {
            action: 'signup.index'
        });
    }]);