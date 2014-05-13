'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    var features = window.JP.get('features');
    if (features && features.provisioningLimits !== 'enabled') {
        return;
    }

    routeProvider
        .when('/limits', {
            title: 'User Limits',
            action: 'limits.index'
        });
}]);