'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    var features = window.JP.get('features');
    if (features && features.rbac !== 'enabled') {
        return;
    }

    routeProvider
        .when('/accounts', {
            title: 'Accounts',
            action: 'rbac',
            showLatest: true,
            showText: true,
            resolve: {
                data: ['$location', function ($location) {
                    $location.path('/accounts/users');
                }]
            }
        }).when('/accounts/users', {
            title: 'Users',
            action: 'rbac.users'
        }).when('/accounts/user/:id', {
            title: 'User Details',
            action: 'rbac.user'
        }).when('/accounts/user/create', {
            title: 'Create User',
            action: 'rbac.user'
        }).when('/accounts/roles', {
            title: 'Roles',
            action: 'rbac.roles'
        }).when('/accounts/role/:id', {
            title: 'Roles',
            action: 'rbac.role',
            showLatest: true
        }).when('/accounts/role/create', {
            title: 'Create Role',
            action: 'rbac.role',
            showText: true,
            showLatest: true
        }).when('/accounts/policies', {
            title: 'Policies',
            action: 'rbac.policies'
        }).when('/accounts/policy/:id', {
            title: 'Policies',
            action: 'rbac.policy',
            showLatest: true
        }).when('/accounts/policy/create', {
            title: 'Create Policies',
            action: 'rbac.policy',
            showText: true,
            showLatest: true
        });
}]);
