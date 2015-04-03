'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    var features = window.JP.get('features');
    if (features && features.dtrace !== 'enabled') {
        return;
    }

    routeProvider
        .when('/devtools/dtrace', {
            title: 'DTrace',
            action: 'dtrace.index'
        }).when('/devtools/dtrace/heatmap', {
            title: 'Heatmap',
            action: 'dtrace.heatmap'
        }).when('/devtools/dtrace/flamegraph', {
            title: 'Flame Graph',
            action: 'dtrace.flamegraph'
        }).when('/devtools/dtrace/scripts', {
            title: 'Scripts',
            action: 'dtrace.scripts'
        }).when('/devtools/dtrace/script/:id', {
            title: 'Script Details',
            action: 'dtrace.script'
        });
}]);
