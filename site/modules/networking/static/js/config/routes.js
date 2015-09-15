'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    routeProvider.when('/networks', {
        title: 'Networks',
        action: 'networking.index',
        parent: 'machine.index'
    }).when('/networks/create', {
        title: 'Create Fabric Network',
        action: 'networking.create'
    }).when('/networks/:networkid', {
        title: 'Network Details',
        action: 'networking.details',
        showLatest: true,
        showText: true,
        resolve: {
            data: ['$route', '$location', function ($route, $location) {
                if (!$route.current.params.networkid) {
                    $location.path('/networks');
                }
            }]
        }
    }).when('/vlans', {
        title: 'Fabric VLANs',
        action: 'networking.vlans',
        parent: 'machine.index'
    }).when('/vlans/create', {
        title: 'Create Fabric VLAN',
        action: 'networking.vlan-create'
    }).when('/vlans/:datacenter/:vlanid', {
        title: 'Fabric VLAN Details',
        action: 'networking.vlan-details',
        showLatest: true,
        showText: true,
        resolve: {
            data: ['$route', '$location', function ($route, $location) {
                if (!$route.current.params.datacenter || !$route.current.params.vlanid) {
                    $location.path('/vlans');
                }
            }]
        }
    });
}]);