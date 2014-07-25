'use strict';

(function (app) {
    app.controller(
        'downloadSdc.LayoutController',
        [ '$scope', 'requestContext', 'localization',
            function ($scope, requestContext, localization) {
                requestContext.setUpRenderContext('downloadSdc',
                    $scope,
                    {
                        title: localization.translate(null, 'downloadSdc', 'Download SDC Trial')
                    }
                );
            }
        ]);
}(window.JP.getModule('downloadSdc')));