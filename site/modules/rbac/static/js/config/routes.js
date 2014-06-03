'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    var features = window.JP.get('features');
    if (features && features.rbac !== 'enabled') {
        return;
    }

    routeProvider
        .when('/rbac/users', {
            title: 'Users',
            action: 'rbac.users'
        }).when('/rbac/user/:id', {
            title: 'User Summary',
            action: 'rbac.user'
        }).when('/rbac/user/create', {
            title: 'Create User',
            action: 'rbac.user'
        }).when('/rbac/roles', {
            title: 'Roles',
            action: 'rbac.roles'
        }).when('/rbac/role/:id', {
            title: 'Role Summary',
            action: 'rbac.role'
        }).when('/rbac/role/create', {
            title: 'Create Role',
            action: 'rbac.role'
        }).when('/rbac/policies', {
            title: 'Policies',
            action: 'rbac.policies'
        }).when('/rbac/policy/:id', {
            title: 'Policy Summary',
            action: 'rbac.policy'
        }).when('/rbac/policy/create', {
            title: 'Create Policies',
            action: 'rbac.policy'
        });
}]);
