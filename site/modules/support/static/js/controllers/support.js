'use strict';

(function (ng, app) {
    app.controller(
        'SupportController',
        [
            '$scope',
            'requestContext',
            'localization',

            function ($scope, requestContext, localization) {
                localization.bind('support', $scope);
                requestContext.setUpRenderContext('support.index', $scope);
            }

        ]);
}(window.angular, window.JP.getModule('support')));
