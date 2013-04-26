'use strict';

window.JP.main.config(['$routeProvider', function ($routeProvider) {
        $routeProvider
                .when('/', {
            action: 'signup.index'
        });
    }]);