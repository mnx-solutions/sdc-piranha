'use strict';

(function (app) {
    app.controller(
        'docker.LayoutController',
        ['$scope', 'requestContext',
            function ($scope, requestContext) {
                requestContext.setUpRenderContext('docker', $scope);
            }
        ]);
}(window.JP.getModule('docker')));
