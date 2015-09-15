'use strict';

(function (app) {
    app.controller('rbac.RoleListController', [
        '$q',
        '$scope',
        'Account',
        'rbac.Service',
        '$location',
        'PopupDialog',
        'localization',
        function ($q, $scope, Account, service, $location, PopupDialog, localization) {
            $scope.loading = true;

            $scope.roles = [];

            $q.all([
                $q.when(service.listRoles()),
                $q.when(Account.getAccount())
            ]).then(function (result) {
                $scope.roles = result[0] || [];
                $scope.account = result[1];
                $scope.loading = false;
            });

            var errorCallback = function (err) {
                $scope.loading = false;
            };

            if ($scope.features.manta === 'enabled') {
                $scope.gridUserConfig = 'rbac-roles';
            }

            $scope.gridOrder = ['name'];
            $scope.gridProps = [
                {
                    id: 'name',
                    name: 'Name',
                    sequence: 1,
                    active: true,
                    _order: 'name',
                    type: 'html',
                    _getter: function (object) {
                        return '<a href="#!/accounts/role/' + object.id + '">' + object.name + '</a>';
                    }
                },
                {
                    id: 'id',
                    name: 'ID',
                    sequence: 2,
                    active: true,
                    _order: 'id',
                    type: 'html',
                    _getter: function (object) {
                        return '<a href="#!/accounts/role/' + object.id + '">' + object.id + '</a>';
                    }
                },
                {
                    id: 'members',
                    name: 'Members',
                    sequence: 3,
                    type: 'array',
                    active: true
                },
                {
                    id: 'policies',
                    name: 'Policies',
                    sequence: 4,
                    type: 'array',
                    active: true
                }
            ];
            $scope.gridDetailProps = [];
            $scope.gridActionButtons = [
                {
                    label: 'Delete',
                    action: function () {
                        PopupDialog.confirmAction(
                            'Delete role',
                            'delete',
                            'role',
                            $scope.checkedItems.length,
                            function () {
                                $scope.loading = true;
                                var deleteIds = $scope.checkedItems.map(function (item) {
                                    return item.id;
                                });
                                service.deleteRole(deleteIds).then(function () {
                                    service.listRoles().then(function (roles) {
                                        $scope.roles = roles;
                                        $scope.loading = false;
                                        $scope.checkedItems = [];
                                    }, errorCallback);
                                }, errorCallback);
                            }
                        );
                    },
                    sequence: 1
                }
            ];

            $scope.exportFields = {
                ignore: ['checked', 'value', 'default_members']
            };

            $scope.columnsButton = true;
            $scope.searchForm = true;
            $scope.enabledCheckboxes = true;
            $scope.placeHolderText = 'filter roles';


        }
    ]);
}(window.JP.getModule('rbac')));