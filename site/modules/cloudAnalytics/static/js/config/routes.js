'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    var features = window.JP.get('features');
    if (features && features.cloudAnalytics !== 'enabled') {
        return;
    }
    routeProvider
        .when('/cloudAnalytics/:machineid', {
            title: 'Cloud Analytics',
            action: 'cloudAnalytics.index',
            parent: 'machine.details'
        })
        .when('/cloudAnalytics', {
            title: 'Cloud Analytics',
            action: 'cloudAnalytics.index'
        });
}]);