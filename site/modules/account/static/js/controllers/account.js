'use strict';

(function (app) {
    app.controller(
        'AccountController',
        ['$scope', 'Account', 'localization', 'requestContext', 'BillingService', '$q', function ($scope, Account, localization, requestContext, BillingService, $q) {
            localization.bind('account', $scope);
            requestContext.setUpRenderContext('account.index', $scope);

            $scope.loading = true;
            $scope.account = Account.getAccount();
            $scope.sshKeys = Account.getKeys(true);

            $q.all([
                $scope.account,
                $scope.sshKeys
            ]).then(function () {
                $scope.loading = false;
            });

            $scope.openKeyDetails = null;
            $scope.setOpenDetails = function(id) {
                if(id === $scope.openKeyDetails) { //REVIEW: Why not shorthand
                    $scope.openKeyDetails = null;
                } else {
                    $scope.openKeyDetails = id;
                }
            };

            $scope.summary = true;
        }]);
}(window.JP.getModule('Account')));