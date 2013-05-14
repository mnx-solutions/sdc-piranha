'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        routeProvider.when('/cmsadmin', {
            title: 'CMS Admin',
            action: 'cms-admin.index'
        }).when('/cms-admin/:id', {
            title: 'CMS edit',
            action: 'cms-admin.edit'
        });
    }]);

