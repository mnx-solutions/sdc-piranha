'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        if (window.JP.get('features').firewall !== 'disabled') {
            routeProvider.when('/firewall', {
                title: 'Firewall rules',
                action: 'firewall.index'
            });
        }
    }]);