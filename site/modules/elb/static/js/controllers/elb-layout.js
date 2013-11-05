'use strict';

(function (app) {
    app.controller('elb.LayoutController', [
        '$scope',
        'requestContext',
        'localization',

        function ($scope, requestContext, localization) {
            requestContext.setUpRenderContext('elb', $scope, {
                title: localization.translate(null, 'elb', 'Joyent Cloud Management Portal')
            });
        }
    ]);
}(window.JP.getModule('elb')));