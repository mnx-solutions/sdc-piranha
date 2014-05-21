'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    var features = window.JP.get('features');
    if (features && features.rbac !== 'enabled') {
        return;
    }

    routeProvider
        .when('/rbac', {
            title: 'Users',
            action: 'rbac.index'
        }).when('/rbac/user/:id', {
            title: 'User Summary',
            action: 'rbac.user'
        }).when('/rbac/roles', {
            title: 'Roles',
            action: 'rbac.roles'
        });
}]);
