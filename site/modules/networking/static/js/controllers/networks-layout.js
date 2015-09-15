'use strict';

(function (app) {
    app.controller('networking.LayoutController', [
        '$scope',
        'requestContext',
        function ($scope, requestContext) {
            requestContext.setUpRenderContext('networking', $scope);
        }
    ]);
}(window.JP.getModule('Networking')));

