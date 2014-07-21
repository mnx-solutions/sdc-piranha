'use strict';

(function (app) {
    app.controller(
            'machine.LayoutController',
            ['$scope', 'Image', 'requestContext', 'localization', 'PopupDialog',
                function ($scope, Image, requestContext, localization, PopupDialog) {
                    requestContext.setUpRenderContext('machine', $scope,
                        {
                            title: localization.translate(null, 'machine', 'Instances')
                        }
                    );
                }
            ]);
}(window.JP.getModule('Machine')));