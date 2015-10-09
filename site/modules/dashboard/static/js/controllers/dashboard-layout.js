'use strict';

(function (app) {
    app.controller('dashboard.LayoutController', [
        '$scope',
        'requestContext',
        'localization',

        function ($scope, requestContext, localization) {
            requestContext.setUpRenderContext('dashboard', $scope, {
                title: localization.translate(null, 'dashboard', $scope.companyName + ' Management Portal')
            });
        }
    ]);
}(window.JP.getModule('Dashboard')));