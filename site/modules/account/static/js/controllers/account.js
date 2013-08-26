'use strict';

(function (app) {
    app.controller(
        'AccountController', [
            '$scope',
            'Account',
            'localization',
            'requestContext',
            'BillingService',
            '$q',

            function ($scope, Account, localization, requestContext, BillingService, $q) {
                localization.bind('account', $scope);
                requestContext.setUpRenderContext('account.index', $scope);

                $scope.loading = true;
                $scope.account = Account.getAccount();
                $scope.sshKeys = Account.getKeys();

                $q.all([
                    $scope.account,
                    $scope.sshKeys
                ]).then(function () {
                    $scope.loading = false;
                });

                $scope.openKeyDetails = null;
                $scope.setOpenDetails = function(id) {
                    if ($scope.openKeyDetails === id) {
                        $scope.openKeyDetails = null;
                    } else {
                        $scope.openKeyDetails = id;
                    }
                };

                $scope.summary = true;
            }]);
}(window.JP.getModule('Account')));