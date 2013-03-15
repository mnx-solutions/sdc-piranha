'use strict';

(function (app) {
    app.controller(
            'machine.LayoutController',
            ['$scope', 'requestContext',
                function ($scope, requestContext) {
                    requestContext.setUpRenderContext('machine', $scope);
                }
            ]);
}(window.JP.getModule('Machine')));