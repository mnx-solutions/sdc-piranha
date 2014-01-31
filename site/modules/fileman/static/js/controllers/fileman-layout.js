'use strict';

(function (app) {
    app.controller('fileman.LayoutController', [
        '$scope',
        'requestContext',
        'fileman',
        function ($scope, requestContext, fileman) {
            if (!$scope.mantaUser) {
                fileman.getUser(function (error, account) {
                    $scope.mantaUser = account.__read().user;
                    requestContext.setUpRenderContext('fileman', $scope);
                });
            } else {
                requestContext.setUpRenderContext('fileman', $scope);
            }
        }
    ]);
}(window.JP.getModule('Dashboard')));