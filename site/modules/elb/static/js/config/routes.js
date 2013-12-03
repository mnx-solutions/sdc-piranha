'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        routeProvider.when('/slb', {
            title: 'Enable Load Balancing',
            action: 'slb.index'
        }).when('/slb/list', {
            title: 'Load Balancers List',
            action: 'slb.list'
        }).when('/slb/edit/:balancerId', {
            title: 'Create/Edit Load Balancer',
            action: 'slb.edit'
        }).when('/slb/detail/:balancerId', {
            title: 'Load Balancer Details',
            action: 'slb.detail'
        });
    }]);

