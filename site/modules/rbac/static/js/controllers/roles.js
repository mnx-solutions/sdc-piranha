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

            $scope.addNewRole = function () {
                $location.path('rbac/role/create');
            };

            var errorCallback = function (err) {
                $scope.loading = false;
                PopupDialog.errorObj(err);
            };

            $scope.getCheckedItems = function () {
                return $scope.roles.filter(function (el) {
                    return el.checked;
                });
            };

            $scope.noCheckBoxChecked = function () {
                PopupDialog.error(
                    localization.translate(
                        $scope,
                        null,
                        'Error'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'No role selected for the action.'
                    ), function () {
                    }
                );
            };


            $scope.gridUserConfig = Account.getUserConfig().$child('rbac-roles') || {};

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
                        var titleEnding = '';
                        var checkedItems = $scope.getCheckedItems();
                        if (checkedItems.length > 1) {
                            titleEnding = 's';
                        }
                        if (checkedItems.length) {
                            PopupDialog.confirm(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Confirm: Delete role' + titleEnding
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    'Are you sure you want to delete the selected role' + titleEnding
                                ),
                                function () {
                                    $scope.loading = true;
                                    var deleteTasks = [];
                                    checkedItems.forEach(function (item) {
                                        deleteTasks.push($q.when(service.deleteRole(item.id)));
                                    });
                                    $q.all(deleteTasks).then(function () {
                                        service.listRoles().then(function (roles) {
                                            $scope.roles = roles;
                                            $scope.loading = false;
                                        }, errorCallback);
                                    }, errorCallback);
                                }
                            );
                        } else {
                            $scope.noCheckBoxChecked();
                        }
                    },
                    sequence: 1
                }
            ];

            $scope.exportFields = {
                ignore: ['checked']
            };

            $scope.columnsButton = true;
            $scope.searchForm = true;
            $scope.enabledCheckboxes = true;
            $scope.placeHolderText = 'filter';


        }
    ]);
}(window.JP.getModule('rbac')));