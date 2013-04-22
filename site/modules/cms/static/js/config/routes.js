'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        routeProvider.when('/cms', {
            title: 'CMS',
            action: 'cms.index'
        }).when('/cms/:id', {
            title: 'CMS edit',
            action: 'cms.edit'
        });
    }]);

