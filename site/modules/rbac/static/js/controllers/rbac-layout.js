'use strict';

(function (app) {
    app.controller('rbac.LayoutController', [
        '$scope',
        'requestContext',
        function ($scope, requestContext) {
            requestContext.setUpRenderContext('rbac', $scope);
        }
    ]);
}(window.JP.getModule('rbac')));