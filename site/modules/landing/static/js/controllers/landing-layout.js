'use strict';

(function (app) {
    app.controller(
            'landing.LayoutController',
            ['$scope', 'requestContext',
                function ($scope, requestContext) {
                    requestContext.setUpRenderContext('landing', $scope);
                }
            ]);
}(window.JP.getModule('Landing')));