'use strict';

(function (app) {
    app.controller('cloudAnalytics.LayoutController', [
        '$scope',
        'requestContext',
        'localization',

        function ($scope, requestContext, localization) {
            requestContext.setUpRenderContext('cloudAnalytics', $scope, {
                title: localization.translate(null, 'cloudAnalytics', 'Analyze ' + $scope.companyName + ' Performance')
            });
        }
    ]);
}(window.JP.getModule('cloudAnalytics')));