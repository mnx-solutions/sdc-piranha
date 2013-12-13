'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        routeProvider
            .when('/fileman', {
                title: 'File Manager',
                action: 'fileman.index'
            });
    }]);