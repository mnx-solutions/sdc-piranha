'use strict';

(function (app) {
    app.controller('utilization.LayoutController', [
        '$scope',
        'requestContext',
        'localization',

        function ($scope, requestContext, localization) {
            requestContext.setUpRenderContext('utilization', $scope, {
                title: localization.translate(null, 'utilization', 'Utilization Page')
            });
        }
    ]);
}(window.JP.getModule('utilization')));