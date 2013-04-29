'use strict';

(function (ng, app) {
    app.controller(
        'error.LayoutController',
        [ '$scope', 'requestContext', 'localization',
            function ($scope, requestContext, localization) {
                requestContext.setUpRenderContext('error',
                    $scope,
                    {
                        title: localization.translate(null, 'error', 'Error')
                    }
                );
            }
        ]);
}(window.angular, window.JP.getModule('error')));