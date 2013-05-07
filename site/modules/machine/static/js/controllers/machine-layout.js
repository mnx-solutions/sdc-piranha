'use strict';

(function (app) {
    app.controller(
            'machine.LayoutController',
            ['$scope', 'requestContext', 'localization',
                function ($scope, requestContext, localization) {
                    requestContext.setUpRenderContext('machine',
                        $scope,
                        {
                            title: localization.translate(null, 'machine', 'Instances')
                        }
                    );
                }
            ]);
}(window.JP.getModule('Machine')));