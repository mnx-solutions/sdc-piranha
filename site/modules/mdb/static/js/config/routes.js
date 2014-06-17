'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    var features = window.JP.get('features');
    if (features && features.mdb !== 'enabled') {
        return;
    }

    routeProvider
        .when('/mdb', {
            title: 'Node Debugger',
            action: 'mdb.index'
        });
}]);