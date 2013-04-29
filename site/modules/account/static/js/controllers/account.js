'use strict';

(function (app) {
    app.controller(
        'AccountController',
        ['$scope', 'Account', 'localization', 'requestContext', 'BillingService', '$location', function ($scope, Account, localization, requestContext, BillingService, $location) {
            requestContext.setUpRenderContext('account.index', $scope);
            localization.bind('account', $scope);
            $scope.account = Account.getAccount();
            $scope.sshKeys = Account.getKeys();
            $scope.payments = BillingService.getPaymentMethods();

        }]);
}(window.JP.getModule('Account')));