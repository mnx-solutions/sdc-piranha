'use strict';

(function (app) {
    app.controller(
        'CMSController',
        [   '$scope',
            'requestContext',
            '$http',
            function ($scope, requestContext, $http) {
                requestContext.setUpRenderContext('cms.index', $scope);
                var id = requestContext.getParam('id');
                $http.get('cms/' + id).success(function (data) {
                    $scope.data = data;
                }).error(function (e) {
                    $scope.error = true;
                });
            }
        ]);
}(window.JP.getModule('CMS')));