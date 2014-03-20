'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        routeProvider
            .when('/manta/files', {
                title: 'File Manager',
                action: 'fileman.index',
                parent: 'manta.index'
            });
    }]);