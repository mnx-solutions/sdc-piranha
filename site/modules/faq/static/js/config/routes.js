'use strict';

window.JP.main.config(['routeProvider', function (routeProvider) {

    routeProvider
        .when('/faq', {
            title: 'Getting Started',
            action: 'faq.index'
        });
}]);
