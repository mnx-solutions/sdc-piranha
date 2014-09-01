'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    var features = window.JP.get('features');
    if (features && features.cdn !== 'enabled') {
        return;
    }

    routeProvider
        .when('/manta/cdn', {
            title: 'CDN Configurations',
            action: 'cdn.index'
        });
}]);