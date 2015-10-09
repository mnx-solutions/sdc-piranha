'use strict';

(function (app) {
    app.controller('storage.LayoutController', [
        '$scope',
        'requestContext',
        'localization',
        'fileman',

        function ($scope, requestContext, localization, fileman) {
            requestContext.setUpRenderContext('storage', $scope, {
                title: localization.translate(null, 'storage',  $scope.companyName + ' Management Portal')
            });
        }
    ]);
}(window.JP.getModule('Storage')));