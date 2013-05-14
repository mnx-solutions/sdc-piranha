'use strict';

(function (app, $) {
    app.controller(
        'CMSAdmin.Controller',
        [   '$scope',
            'requestContext',
            'CMSService',
            '$q',
            function ($scope, requestContext, CMSService, $q) {
                requestContext.setUpRenderContext('cms-admin.index', $scope);
                $scope.data = CMSService.getData();
            }
        ]);
}(window.JP.getModule('CMSAdmin'), window.jQuery));