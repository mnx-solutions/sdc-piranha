'use strict';

(function (app) {
    app.controller(
            'cms.LayoutController',
            ['$scope', 'requestContext', 'localization',
                function ($scope, requestContext, localization) {
                    requestContext.setUpRenderContext('cms',
                        $scope,
                        {
                            title: 'CMS'
                        }
                    );
                }
            ]);
}(window.JP.getModule('CMS')));