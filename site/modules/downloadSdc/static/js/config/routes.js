'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        var features = window.JP.get('features');
        if (features && features.downloadSdc !== 'enabled') {
            return;
        }

        routeProvider.when('/downloadSdc', {
            title: 'Download SDC Trial',
            action: 'downloadSdc.index'
        });
    }
]);