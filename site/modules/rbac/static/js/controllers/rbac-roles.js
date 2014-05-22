'use strict';

(function (app) {
    app.controller('rbacRolesController', [
        '$scope',
        'Account',
        '$location',
        function ($scope, Account, $location) {
            $scope.loading = true;
            $scope.account;

            $scope.roles = [];

            $scope.addNewRole = function () {
                $location.path('rbac/role-edit');
            };

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
                },
                {
                    id: 'edit',
                    name: 'Edit',
                    type: 'button',
                    getClass: function () {
                        return 'pull-right span1';
                    },
                    btn: {
                        label: 'Edit',
                        getClass: function () {
                            return 'btn-edit ci effect-orange-button';
                        },
                        disabled: function () {
                            return $scope.loading;
                        },
                        action: function (object) {
                            // TODO
                        },
                        tooltip: 'Edit the rule'
                    },
                    sequence: 5,
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