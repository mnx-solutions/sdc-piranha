'use strict';

(function (app) {
    app.controller('rbac.UserListController', [
        '$q',
        '$scope',
        'PopupDialog',
        'Account',
        'rbac.Service',
        'localization',
        function ($q, $scope, PopupDialog, Account, service, localization) {
            $scope.loading = true;
            $scope.users = [];
            $scope.roles = [];
            var getUsersList = function () {
                $q.all([
                    $q.when(service.listUsers()),
                    $q.when(service.listRoles())
                ]).then(function (result) {
                    $scope.users = angular.copy(result[0]) || [];
                    $scope.roles = result[1] || [];
                    $scope.loading = false;
                });
            };
            getUsersList();

            $scope.noCheckBoxChecked = function () {
                PopupDialog.noItemsSelectedError('user');
            };

            if ($scope.features.manta === 'enabled') {
                $scope.gridUserConfig = Account.getUserConfig().$child('rbac-users') || {};
            }

            $scope.gridOrder = ['login'];
            $scope.gridProps = [
                {
                    id: 'id',
                    name: 'ID',
                    sequence: 1,
                    type: 'html',
                    _getter: function (object) {
                        return '<a href="#!/accounts/user/' + object.id + '">' + object.id + '</a>';
                    },
                    active: false
                },
                {
                    id: 'login',
                    name: 'Username',
                    sequence: 2,
                    type: 'html',
                    _order: 'login',
                    _getter: function (object) {
                        return '<a href="#!/accounts/user/' + object.id + '">' + object.login + '</a>';
                    },
                    active: true
                },
                {
                    id: 'email',
                    name: 'Email',
                    sequence: 3,
                    active: true
                },
                {
                    name: 'Roles',
                    sequence: 4,
                    active: true,
                    type: 'async',
                    _getter: function (object) {
                        var roles = [];
                        $scope.roles.forEach(function(role) {
                            if (role.members && role.members.indexOf(object.login) > -1) {
                                roles.push(role.name);
                            }
                        });
                        return (roles || []).join(", ");
                    }

                },
                {
                    id: 'companyName',
                    name: 'Company Name',
                    sequence: 5,
                    active: false
                },
                {
                    id: 'firstName',
                    name: 'First Name',
                    sequence: 6,
                    active: false
                },
                {
                    id: 'lastName',
                    name: 'Last Name',
                    sequence: 7,
                    active: false
                },
                {
                    id: 'address',
                    name: 'Address',
                    sequence: 8,
                    active: false
                },
                {
                    id: 'postalCode',
                    name: 'Zip code',
                    entryType: Number,
                    sequence: 9,
                    active: false
                },
                {
                    id: 'city',
                    name: 'City',
                    sequence: 10,
                    active: false
                },
                {
                    id: 'state',
                    name: 'State',
                    sequence: 11,
                    active: false
                },
                {
                    id: 'country',
                    name: 'Country',
                    sequence: 12,
                    active: false
                },
                {
                    id: 'phone',
                    name: 'Phone',
                    entryType: Number,
                    sequence: 13,
                    active: false
                },
                {
                    id: 'created',
                    name: 'Created Date',
                    sequence: 14,
                    type: 'date',
                    active: true
                },
                {
                    id: 'updated',
                    name: 'Updated Date',
                    sequence: 15,
                    type: 'date',
                    active: false
                }

            ];
            $scope.gridDetailProps = [];
            $scope.gridActionButtons = [
                {
                    label: 'Delete',
                    action: function () {
                        if ($scope.checkedItems.length) {
                            var titleEnding = $scope.checkedItems.length === 1 ? '' : 's';
                            PopupDialog.confirm(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Confirm: Delete user' + titleEnding
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    'Are you sure you want to delete the selected user' + titleEnding + '?'
                                ),
                                function () {
                                    $scope.loading = true;
                                    var deleteUsernames = {};
                                    var deleteIds = $scope.checkedItems.map(function (item) {
                                        deleteUsernames[item.id] = item.login;
                                        return item.id;
                                    });
                                    service.deleteUser(deleteIds, deleteUsernames).then(function () {
                                        getUsersList();
                                        $scope.checkedItems = [];
                                    }, function (err) {
                                        service.updateCache({ids: deleteIds}, {}, 'user', service.ACCESS.WRITE);
                                        PopupDialog.errorObj(err);
                                        getUsersList();
                                    });
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
                ignore: ['checked', 'value']
            };

            $scope.columnsButton = true;
            $scope.searchForm = true;
            $scope.enabledCheckboxes = true;
            $scope.placeHolderText = 'filter users';

        }
    ]);
}(window.JP.getModule('rbac')));