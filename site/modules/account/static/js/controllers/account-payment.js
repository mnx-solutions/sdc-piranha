'use strict';

(function (app) {
    app.controller(
        'Account.PaymentController', [
            '$scope',
            'requestContext',
            'Account',
            function ($scope, requestContext, Account) {
                requestContext.setUpRenderContext('account.payment', $scope);

                $scope.loading = true;
                Account.getAccount().then(function (account) {
                    $scope.provisionEnabled = account.provisionEnabled;
                    $scope.loading = false;
                });
            }]);
}(window.JP.getModule('Account')));