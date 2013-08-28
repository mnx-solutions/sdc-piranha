'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {
    routeProvider.when('/maxmind', {
        action: 'maxmind.index'
    });
}]);