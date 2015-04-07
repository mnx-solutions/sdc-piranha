'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    var features = window.JP.get('features');
    if (features && features.mdb !== 'enabled') {
        return;
    }

    routeProvider
        .when('/devtools/mdb', {
            title: 'Debugger Jobs',
            action: 'mdb.index'
        })
        .when('/devtools/mdb/:jobId', {
            title: 'Node.js Debugger Job',
            action: 'mdb.detail'
        });
}]);