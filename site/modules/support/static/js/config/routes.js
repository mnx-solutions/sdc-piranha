'use strict';

window.JP.main.config([
    'routeProvider',
    function (routeProvider) {
        routeProvider.when('/support', {
            title: 'Support',
            action: 'support.index'
        });
    }]);

window.JP.main.run([ 'Menu', function (Menu) {
    Menu.register({
        name: 'Support',
        link: 'support'
    });
}]);
