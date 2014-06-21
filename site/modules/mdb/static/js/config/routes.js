'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    var features = window.JP.get('features');
    if (features && features.mdb !== 'enabled') {
        return;
    }

    routeProvider
        .when('/mdb', {
            title: 'Node.js Debugger',
            action: 'mdb.index'
        })
        .when('/mdb/:jobId', {
            title: 'Node.js Debugger Job',
            action: 'mdb.detail'
        });
}]);