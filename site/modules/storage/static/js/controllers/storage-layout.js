'use strict';

(function (app) {
    app.controller('storage.LayoutController', [
        '$scope',
        'requestContext',
        'localization',

        function ($scope, requestContext, localization) {
            requestContext.setUpRenderContext('storage', $scope, {
                title: localization.translate(null, 'storage', 'Joyent Cloud Management Portal')
            });
        }
    ]);
}(window.JP.getModule('Dashboard')));