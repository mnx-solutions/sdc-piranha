'use strict';

(function (app) {
    app.controller(
        'AccountController',
        ['$scope', 'Account', 'localization', 'requestContext', 'BillingService', '$location', function ($scope, Account, localization, requestContext, BillingService, $location) {
            requestContext.setUpRenderContext('account.index', $scope);
            localization.bind('account', $scope);

            $scope.account = Account.getAccount();
            $scope.sshKeys = Account.getKeys(true);
            $scope.paymentMethods = BillingService.getPaymentMethods();

            $scope.openKeyDetails = null;
            $scope.setOpenDetails = function(id) {
                if(id === $scope.openKeyDetails) {
                    $scope.openKeyDetails = null;
                } else {
                    $scope.openKeyDetails = id;
                }
            };

            $scope.summary = true;
        }]);
}(window.JP.getModule('Account')));