'use strict';

(function (app) {
    app.controller('faq.LayoutController', [
        '$scope',
        'requestContext',
        'localization',

        function ($scope, requestContext, localization) {
            requestContext.setUpRenderContext('faq', $scope, {
                title: localization.translate(null, 'faq', 'Joyent FAQ')
            });
        }
    ]);
}(window.JP.getModule('Faq')));