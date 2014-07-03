'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    var features = window.JP.get('features');
    if (features && features.support === 'disabled') {
        return;
    }
    routeProvider
        .when('/support', {
            title: 'Support',
            action: 'support.index'
        })
        .when('/support/:link', {
            title: 'Cloud Node.js',
            action: 'support.index'
        });
}]);
