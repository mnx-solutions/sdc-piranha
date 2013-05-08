'use strict';

(function (app) {
    app.controller(
        'account.LayoutController',
        ['$scope', 'requestContext', 'Account', 'BillingService',
            function ($scope, requestContext, Account, BillingService) {
                requestContext.setUpRenderContext('account', $scope);

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