'use strict';

(function (app) {
    app.controller(
            'tfa.LayoutController',
            ['$scope', 'requestContext',
                function ($scope, requestContext) {
                    requestContext.setUpRenderContext('tfa', $scope);
                }
            ]);
}(window.JP.getModule('TFA')));