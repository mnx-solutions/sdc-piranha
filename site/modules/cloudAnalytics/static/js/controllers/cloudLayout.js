'use strict';

(function (app) {
    app.controller(
        'cloudAnalytics.LayoutController',
        ['$scope', 'requestContext',
            function ($scope, requestContext) {
                requestContext.setUpRenderContext('cloudAnalytics', $scope);

            }
        ]);
}(window.JP.getModule('cloudAnalytics')));