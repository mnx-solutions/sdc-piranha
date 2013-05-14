'use strict';

(function (app) {
    app.controller(
            'cms-admin.LayoutController',
            ['$scope', 'requestContext', 'localization',
                function ($scope, requestContext, localization) {
                    requestContext.setUpRenderContext('cms-admin',
                        $scope,
                        {
                            title: 'CMS'
                        }
                    );
                }
            ]);
}(window.JP.getModule('CMSAdmin')));