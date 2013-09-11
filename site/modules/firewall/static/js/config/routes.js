'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        routeProvider.when('/firewall', {
            title: 'Firewall rules',
            action: 'firewall.index'
        });
    }]);