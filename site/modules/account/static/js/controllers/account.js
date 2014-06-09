'use strict';

(function (app) {
    app.controller(
        'AccountController', [
            '$scope',
            'Account',
            'localization',
            'requestContext',
            '$q',

            function ($scope, Account, localization, requestContext, $q) {
                localization.bind('account', $scope);
                requestContext.setUpRenderContext('account.index', $scope);

                $scope.loading = true;
                Account.getAccount().then(function (account) {
                    $scope.account = account;
                });

                $q.all([
                    $scope.account
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