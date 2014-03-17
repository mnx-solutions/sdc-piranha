'use strict';

(function (app) {
    app.controller('support.LayoutController', [
        '$scope',
        'requestContext',
        'localization',

        function ($scope, requestContext, localization) {
            requestContext.setUpRenderContext('support', $scope, {
                title: localization.translate(null, 'support', 'Joyent Support')
            });
        }
    ]);
}(window.JP.getModule('support')));