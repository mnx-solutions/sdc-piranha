'use strict';

(function (app) {
    app.controller('rbacUserController', [
        '$scope',
        'Account',
        function ($scope, Account) {
            $scope.loading = true;
            Account.getAccount(true).then(function (account) {
                $scope.account = account;
                $scope.loading = false;
            });
        }
    ]);
}(window.JP.getModule('Rbac')));