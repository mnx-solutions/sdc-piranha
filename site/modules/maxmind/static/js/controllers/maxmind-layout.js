'use strict';

(function (app) {
    app.controller('maxmind.LayoutController', [
        '$scope',
        'requestContext',
        'localization',

        function ($scope, requestContext, localization) {
            requestContext.setUpRenderContext('maxmind', $scope, {
                title: localization.translate(null, 'maxmind', 'Joyent Cloud Management Portal')
            });
        }
    ]);
}(window.JP.getModule('MaxMind')));