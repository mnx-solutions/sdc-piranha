'use strict';

(function (app) {
    app.controller(
            'account-admin.LayoutController',
            ['$scope', 'requestContext', 'localization',
                function ($scope, requestContext, localization) {
                    requestContext.setUpRenderContext('account-admin',
                        $scope,
                        {
                            title: localization.translate(null, 'account-admin', 'Account')
                        }
                    );
                }
            ]);
}(window.JP.getModule('AccountAdmin')));