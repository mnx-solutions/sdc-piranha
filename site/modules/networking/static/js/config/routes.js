'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    var features = window.JP.get('features');
    if (features && features.networking !== 'enabled') {
        return;
    }

    routeProvider.when('/network/networks', {
        title: 'Networks',
        action: 'networking.index'
    }).when('/network/networks/create', {
        title: 'Create Fabric Network',
        action: 'networking.create'
    }).when('/network/networks/:networkid', {
        title: 'Network Details',
        action: 'networking.details',
        showLatest: true,
        showText: true,
        resolve: {
            data: ['$route', '$location', function ($route, $location) {
                if (!$route.current.params.networkid) {
                    $location.path('/network/networks');
                }
            }]
        }
    }).when('/network/vlans', {
        title: 'Fabric VLANs',
        action: 'networking.vlans'
    }).when('/network/vlans/create', {
        title: 'Create Fabric VLAN',
        action: 'networking.vlan-create'
    }).when('/network/vlans/:datacenter/:vlanid', {
        title: 'Fabric VLAN Details',
        action: 'networking.vlan-details',
        showLatest: true,
        showText: true,
        resolve: {
            data: ['$route', '$location', function ($route, $location) {
                if (!$route.current.params.datacenter || !$route.current.params.vlanid) {
                    $location.path('/network/vlans');
                }
            }]
        }
    });
}]);