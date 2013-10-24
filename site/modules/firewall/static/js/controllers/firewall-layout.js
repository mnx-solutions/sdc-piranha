'use strict';

(function (app) {
    app.controller('firewall.LayoutController', [
        '$scope',
        'requestContext',
        'localization',

        function ($scope, requestContext, localization) {
            requestContext.setUpRenderContext('firewall', $scope, {
                title: localization.translate(null, 'firewall', 'Joyent Cloud Management Portal')
            });
        }
    ]);
}(window.JP.getModule('firewall')));