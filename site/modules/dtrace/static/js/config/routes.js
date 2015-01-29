'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    var features = window.JP.get('features');
    if (features && features.dtrace !== 'enabled') {
        return;
    }

    routeProvider
        .when('/dtrace', {
            title: 'DTrace',
            action: 'dtrace',
            showLatest: true,
            showText: true,
            resolve: {
                data: ['$location', function ($location) {
                    $location.path('/dtrace/heatmap');
                }]
            }
        }).when('/dtrace/heatmap', {
            title: 'Heatmap',
            action: 'dtrace.heatmap'
        }).when('/dtrace/flamegraph', {
            title: 'Flamegraph',
            action: 'dtrace.flamegraph'
        }).when('/dtrace/scripts', {
            title: 'Scripts',
            action: 'dtrace.scripts'
        }).when('/dtrace/script/:id', {
            title: 'Script Details',
            action: 'dtrace.script'
        });
}]);
