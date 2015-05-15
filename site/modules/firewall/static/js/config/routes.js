'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        var features = window.JP.get('features');
        if (features && features.firewall !== 'disabled') {
            routeProvider.when('/firewall', {
                title: 'Cloud Firewall',
                action: 'firewall.index',
                parent: 'machine.index'
            }).when('/docker/firewall', {
                title: 'Cloud Firewall',
                action: 'firewall.index',
                parent: 'machine.index'
            });
        }
    }]);
