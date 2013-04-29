'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        routeProvider.when('/error', {
            title: 'Error',
            action: 'error.index'
        });
    }]);