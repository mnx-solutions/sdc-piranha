'use strict';

(function (app) {
    app.controller(
            'machine.LayoutController',
            ['$scope', 'requestContext', 'localization',
                function ($scope, requestContext, localization) {
                    requestContext.setUpRenderContext('machine',
                        $scope,
                        {
                            title: localization.translate(null, 'machine', 'Machines')
                        }
                    );
                }
            ]);
}(window.JP.getModule('Machine')));