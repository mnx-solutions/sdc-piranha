'use strict';

(function (app) {
    app.controller(
        'AccountController',
        ['$scope', 'Account', 'localization', 'requestContext', 'BillingService', '$q', function ($scope, Account, localization, requestContext, BillingService, $q) {
            requestContext.setUpRenderContext('account.index', $scope);
            localization.bind('account', $scope);

            $scope.loading = true;
            var c = 0;
            function checkAll() {
                c++;
                return function () {
                    if(--c <= 0) {
                        $scope.loading = false;
                    } else {
                        $scope.loading = true;
                    }
                };
            }
            $scope.account = Account.getAccount();
            $scope.sshKeys = Account.getKeys(true);
            $scope.paymentMethods = BillingService.getPaymentMethods();

            $q.when($scope.account, checkAll());
            $q.when($scope.sshKeys, checkAll());
            $q.when($scope.paymentMethods, checkAll());

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