'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        routeProvider.when('/elb', {
            title: 'ELB',
            action: 'elb.index'
        });
    }]);

