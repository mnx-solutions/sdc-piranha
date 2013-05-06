'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        routeProvider.when('/dashboard', {
            title: 'Dashboard',
            action: 'dashboard.index'
        });
    }]);

window.JP.main.run(['Menu', function (Menu) {
    }]);
