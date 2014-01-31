'use strict';

(function (app) {
    app.controller('fileman.LayoutController', [
        '$scope',
        'requestContext',
        'Account',
        function ($scope, requestContext, Account) {
            Account.getAccount().then(function (account) {
                $scope.account = account;
                requestContext.setUpRenderContext('fileman', $scope);
            });
        }
    ]);
}(window.JP.getModule('Dashboard')));