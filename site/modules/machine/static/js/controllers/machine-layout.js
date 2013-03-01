'use strict';

(function (app) {
    app.controller(
            'MachineLayoutController',
            ['$scope', 'requestContext',
                function ($scope, requestContext) {
                    requestContext.setUpRenderContext('machine', $scope);
                }
            ]);
}(window.JP.getModule('Machine')));