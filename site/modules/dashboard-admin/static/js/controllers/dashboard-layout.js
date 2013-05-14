'use strict';

(function (app) {
    app.controller(
            'dashboard-admin.LayoutController',
            ['$scope', 'requestContext', 'localization',
                function ($scope, requestContext, localization) {
                    requestContext.setUpRenderContext('dashboard-admin',
                        $scope,
                        {
                            title: localization.translate(null, 'dashboard', 'Dashboard')
                        }
                    );
                }
            ]);
}(window.JP.getModule('DashboardAdmin')));