'use strict';

(function (app) {
    app.controller('rbacUserController', [
        '$scope',
        'Account',
        function ($scope, Account) {
            $scope.loading = true;
            $scope.account;

            $scope.roles = [
                { label: 'Operations', value: 1 },
                { label: 'Engineering', value: 2 },
                { label: 'Support', value: 3 },
                { label: 'Release Management', value: 4 }
            ];

            Account.getAccount(true).then(function (account) {
                $scope.account = account;
                $scope.loading = false;
            });



        }
    ]);
}(window.JP.getModule('Rbac')));