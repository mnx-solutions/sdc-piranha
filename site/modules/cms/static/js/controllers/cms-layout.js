'use strict';

(function (app) {
    app.controller(
            'cms.LayoutController',
            ['$scope', 'requestContext',
                function ($scope, requestContext) {
                    requestContext.setUpRenderContext('cms',
                        $scope,
                        {
                            title: 'CMS'
                        }
                    );
                }
            ]);
}(window.JP.getModule('CMS')));