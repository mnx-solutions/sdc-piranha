'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    routeProvider
        .when('/cloudAnalytics', {
            title: 'Cloud analytics',
            action: 'cloudAnalytics.index'
        })
        .when('/cloudAnalytics/:machine', {
            title: 'Instance analytics',
            action: 'cloudAnalytics.index'
        });
}]);

window.JP.main.run(['Menu', function (Menu) {
    Menu.register({
        name: 'Cloud Analytics',
        link: 'cloudAnalytics'
    });
}]);
