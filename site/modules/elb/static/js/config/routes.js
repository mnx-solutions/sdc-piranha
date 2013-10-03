'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        routeProvider.when('/elb', {
            title: 'Enable Load Balancing',
            action: 'elb.index'
        }).when('/elb/list', {
            title: 'Load Balancers List',
            action: 'elb.list'
        }).when('/elb/edit/:balancerId', {
            title: 'Create/Edit Load Balancer',
            action: 'elb.edit'
        }).when('/elb/detail/:balancerId', {
            title: 'Load Balancer Details',
            action: 'elb.detail'
        });
    }]);

