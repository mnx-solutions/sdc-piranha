'use strict';

window.JP.main.config(['$routeProvider', function ($routeProvider) {
        $routeProvider
            .when('/tfa', {
                action: 'tfa.index'
            });
    }]);