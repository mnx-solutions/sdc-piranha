'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    routeProvider
        .when('/storage', {
            title: 'Storage',
            action: 'storage.index'
        })
        .when('/storage/history', {
            title: 'Storage',
            action: 'storage.history'
        });
}]);