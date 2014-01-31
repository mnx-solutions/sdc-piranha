'use strict';

(function (app) {
    app.controller('fileman.LayoutController', [
        '$scope',
        'requestContext',
        'fileman',
        function ($scope, requestContext, fileman) {
            fileman.getUser(function (error, account) {
                $scope.account = account.__read().user;
                requestContext.setUpRenderContext('fileman', $scope);
            });
        }
    ]);
}(window.JP.getModule('Dashboard')));