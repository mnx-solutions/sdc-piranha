'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        routeProvider.when('/cms/:id', {
            title: 'CMS',
            action: 'cms.index'
        });
    }]);

