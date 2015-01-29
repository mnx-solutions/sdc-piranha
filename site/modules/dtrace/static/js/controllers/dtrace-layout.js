'use strict';

(function (app) {
    app.controller(
        'dtrace.LayoutController',
        ['$scope', 'requestContext',
            function ($scope, requestContext) {
                requestContext.setUpRenderContext('dtrace', $scope);
            }
        ]);
}(window.JP.getModule('dtrace')));
