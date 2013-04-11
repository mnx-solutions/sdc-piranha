'use strict';

(function (app) {
    app.controller(
        'cloudAnalytics.LayoutController',
        ['$scope', 'requestContext',
            function ($scope, requestContext) {
                console.log('CA layout');
                requestContext.setUpRenderContext('cloudAnalytics', $scope);

            }
        ]);
}(window.JP.getModule('cloudAnalytics')));