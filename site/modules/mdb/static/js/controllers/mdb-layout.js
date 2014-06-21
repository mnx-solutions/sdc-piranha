'use strict';

(function (app) {
    app.controller('mdb.LayoutController', [
        '$scope',
        'requestContext',
        function ($scope, requestContext) {
            requestContext.setUpRenderContext('mdb', $scope);
        }
    ]);
}(window.JP.getModule('mdb')));