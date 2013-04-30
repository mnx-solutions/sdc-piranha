'use strict';

(function (app) {
    app.controller(
        'account.LayoutController',
        ['$scope', 'requestContext', 'Account', 'BillingService', '$q',
            function ($scope, requestContext, Account, BillingService, $q) {
                requestContext.setUpRenderContext('account', $scope);

                $scope.account = Account.getAccount();
                $scope.setAccount = function (account) {
                    $scope.account = account;
                };

                $scope.sshKeys = Account.getKeys();
                $scope.setSshKeys = function(sshs) {
                    $scope.sshKeys = sshs;
                };

                $scope.creditCard = BillingService.getDefaultCreditCard();
                $q.when($scope.creditCard, function (cc) {
                    $scope.creditCardJSON = JSON.stringify(cc, null, 2);
                });
                $scope.setCreditCard = function (cc) {
                    $scope.creditCard = cc;
                    $scope.creditCardJSON = JSON.stringify(cc, null, 2);
                };

            }
        ]);
}(window.JP.getModule('Account')));