'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        routeProvider
	        .when('/dashboard', {
	            title: 'Dashboard',
	            action: 'dashboard.index'
	        })
	        .when('/', {
                redirectTo: '/dashboard'
            });
    }]);