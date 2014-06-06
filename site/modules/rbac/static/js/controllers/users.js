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
            var getUsersList = function () {
                service.listUsers().then(function (users) {
                    $scope.users = users || [];
                    $scope.loading = false;
                }, function (err) {
                    PopupDialog.errorObj(err);
                });
            };
            getUsersList();

            var errorCallback = function (err) {
                $scope.loading = false;
                PopupDialog.errorObj(err);
            };

            $scope.getCheckedItems = function () {
                return $scope.users.filter(function (el) {
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
                        'No user selected for the action.'
                    ), function () {}
                );
            };

            $scope.gridUserConfig = Account.getUserConfig().$child('rbac') || {};

            $scope.gridOrder = ['-published_at'];
            $scope.gridProps = [
                {
                    id: 'login',
                    name: 'Login',
                    sequence: 1,
                    type: 'html',
                    _getter: function (object) {
                        return '<a href="#!/rbac/user/' + object.id + '">' + object.login + '</a>';
                    },
                    active: true
                },
                {
                    id: 'email',
                    name: 'Email',
                    sequence: 2,
                    active: true
                },
                {
                    id: 'created',
                    name: 'Created Date',
                    sequence: 3,
                    type: 'date',
                    active: true
                },
                {
                    name: 'Role',
                    sequence: 4,
                    active: true,
                    type: 'async',
                    hideSorter: true,
                    _getter: function (object) {
                        return service.getUser(object.id).then(function (user) {
                            return (user.roles || []).join(", ");
                        }, function () {
                            return "";
                        });
                    }

                }
            ];
            $scope.gridDetailProps = [];
            $scope.gridActionButtons = [
                {
                    label: 'Delete',
                    action: function (object) {
                        //FIXME: Let's create simple "pluralize" method in utils and use it here
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
                                    'Confirm: Delete user' + titleEnding
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    'Are you sure you want to delete the selected user' + titleEnding
                                ),
                                function () {
                                    $scope.loading = true;
                                    var deleteTasks = [];
                                    checkedItems.forEach(function (item) {
                                        deleteTasks.push($q.when(service.deleteUser(item.id)));
                                    });
                                    $q.all(deleteTasks).then(function () {
                                        getUsersList();
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
                ignore: []
            };

            $scope.columnsButton = true;
            $scope.searchForm = true;
            $scope.enabledCheckboxes = true;
            $scope.placeHolderText = 'filter';

        }
    ]);
}(window.JP.getModule('rbac')));