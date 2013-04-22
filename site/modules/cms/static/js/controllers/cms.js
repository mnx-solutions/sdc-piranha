'use strict';

(function (app, $) {
    app.controller(
        'CMSController',
        [   '$scope',
            'requestContext',
            'CMSService',
            '$q',
            function ($scope, requestContext, CMSService, $q) {
                requestContext.setUpRenderContext('cms.index', $scope);
                $scope.data = CMSService.getData();
            }
        ]);
}(window.JP.getModule('CMS'), window.jQuery));