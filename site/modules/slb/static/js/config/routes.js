'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        var features = window.JP.get('features');
        if (features && features.slb === 'disabled') {
            return;
        }
        routeProvider.when('/slb', {
            title: 'Load Balancers',
            action: 'slb.index',
            parent: 'machine.index'
        }).when('/slb/list', {
            title: 'Load Balancers List',
            action: 'slb.list'
        }).when('/slb/edit/', {
            title: 'Create Load Balancer',
            action: 'slb.edit'
        }).when('/slb/edit/:balancerId', {
            title: 'Edit Load Balancer',
            action: 'slb.edit'
        }).when('/slb/detail/:balancerId', {
            title: 'Load Balancer Details',
            action: 'slb.detail'
        });
    }]);
