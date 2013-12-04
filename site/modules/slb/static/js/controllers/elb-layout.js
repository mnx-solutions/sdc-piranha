'use strict';

(function (app) {
    app.controller('slb.LayoutController', [
        '$scope',
        'requestContext',
        'localization',

        function ($scope, requestContext, localization) {
            requestContext.setUpRenderContext('slb', $scope, {
                title: localization.translate(null, 'slb', 'Joyent Cloud Management Portal')
            });
        }
    ]);
}(window.JP.getModule('slb')));