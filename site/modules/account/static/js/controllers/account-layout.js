'use strict';

(function (app) {
    app.controller(
        'account.LayoutController',
        ['$scope', 'requestContext',
            function ($scope, requestContext) {
                requestContext.setUpRenderContext('account', $scope);
            }
        ]);
}(window.JP.getModule('Account')));