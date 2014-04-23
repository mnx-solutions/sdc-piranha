'use strict';

(function (app) {
    app.controller('limits.LayoutController', [
        '$scope',
        'requestContext',
        function ($scope, requestContext) {
            requestContext.setUpRenderContext('limits', $scope);
        }
    ]);
}(window.JP.getModule('Limits')));