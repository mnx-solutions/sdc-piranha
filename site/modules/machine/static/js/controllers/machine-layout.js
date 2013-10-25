'use strict';

(function (app) {
    app.controller(
            'machine.LayoutController',
            ['$scope', 'Image', 'requestContext', 'localization',
                function ($scope, Image, requestContext, localization) {
                    requestContext.setUpRenderContext('machine', $scope,
                        {
                            title: localization.translate(null, 'machine', 'Instances')
                        }
                    );

                    $scope.images = Image.image(true);
                }
            ]);
}(window.JP.getModule('Machine')));