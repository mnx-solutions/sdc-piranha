'use strict';

window.JP.main.config(['$routeProvider', function ($routeProvider) {
        $routeProvider
                .when('/cloudAnalytics', {
            action: 'cloudAnalytics'
        });
    }]);

window.JP.main.run(['Menu', function (Menu) {
        Menu.register({
            name: 'Cloud Analytics',
            link: 'cloudAnalytics'
        });
    }]);
