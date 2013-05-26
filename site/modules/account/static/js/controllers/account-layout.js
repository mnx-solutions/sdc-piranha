'use strict';

(function (app) {
    app.controller('account.LayoutController', [
        '$scope',
        'requestContext',
        'localization',
        'Account',
        'BillingService',

        function ($scope, requestContext, localization, Account, BillingService) {
            requestContext.setUpRenderContext('account', $scope, {
                title: localization.translate(null, 'account', 'Manage My Joyent Account')
            });

            $scope.account = Account.getAccount();
            $scope.setAccount = function (account) {
                $scope.account = account;
            };

            $scope.sshKeys = Account.getKeys();
            $scope.setSshKeys = function(sshs) {
                $scope.sshKeys = sshs;
            };

            $scope.$on('creditCardUpdate', function (event, cc) {
                $scope.creditCard = cc;
            });

            $scope.creditCard = BillingService.getDefaultCreditCard();

        }
    ]);
}(window.JP.getModule('Account')));