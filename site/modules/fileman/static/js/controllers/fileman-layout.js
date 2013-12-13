'use strict';

(function (app) {
    app.controller('fileman.LayoutController', [
        '$scope',
        'requestContext',
        function ($scope, requestContext) {
            requestContext.setUpRenderContext('fileman', $scope);
        }
    ]);
}(window.JP.getModule('Dashboard')));