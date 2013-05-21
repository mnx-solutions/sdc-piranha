'use strict';

(function (app) {
    app.controller(
        'AccountController',
        ['$scope', 'Account', 'localization', 'requestContext', 'BillingService', '$q', function ($scope, Account, localization, requestContext, BillingService, $q) {
            requestContext.setUpRenderContext('account.index', $scope);
            localization.bind('account', $scope);

            $scope.loading = true;
            $scope.account = Account.getAccount();
            $scope.sshKeys = Account.getKeys(true);
			$scope.lastInvoice = BillingService.getLastInvoice();

            $q.all([
                $scope.account,
                $scope.sshKeys,
                $scope.lastInvoice
            ]).then(function () {
                $scope.loading = false;
            });

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