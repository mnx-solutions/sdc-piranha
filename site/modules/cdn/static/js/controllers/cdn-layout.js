'use strict';

(function (app) {
    app.controller('cdn.LayoutController', [
        '$scope',
        'requestContext',
        function ($scope, requestContext) {
            requestContext.setUpRenderContext('cdn', $scope);
        }
    ]);
}(window.JP.getModule('cdn')));