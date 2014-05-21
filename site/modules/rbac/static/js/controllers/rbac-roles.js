'use strict';

(function (app) {
    app.controller('rbacRolesController', [
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
            $scope.gridUserConfig = Account.getUserConfig().$child('rbac') || {};

            $scope.gridOrder = ['-published_at'];
            $scope.gridProps = [
                {
                    id: 'name',
                    name: 'Name',
                    sequence: 1,
                    active: true
                },
                {
                    id: 'id',
                    name: 'ID',
                    sequence: 2,
                    active: true
                },
                {
                    id: 'members',
                    name: 'Members',
                    sequence: 3,
                    active: true
                },
                {
                    id: 'policies',
                    name: 'Policies',
                    sequence: 4,
                    active: true
                }
            ];
            $scope.gridDetailProps = [];

            $scope.exportFields = {
                ignore: []
            };

            $scope.columnsButton = true;
            $scope.searchForm = true;
            $scope.enabledCheckboxes = true;
            $scope.placeHolderText = 'filter';


        }
    ]);
}(window.JP.getModule('Rbac')));