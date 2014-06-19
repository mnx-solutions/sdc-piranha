'use strict';

(function (app) {
    app.controller('rbac.RoleController', [
        '$q',
        '$location',
        '$scope',
        'PopupDialog',
        'Account',
        'rbac.Service',
        'requestContext',
        'localization',
        function ($q, $location, $scope, PopupDialog, Account, service, requestContext, localization) {
            $scope.role = {};
            $scope.policyGroups = [];
            $scope.users = [];
            $scope.roleUsers = [];
            $scope.roleDefaultUsers = [];
            $scope.selectedUsersChanged = false;
            $scope.isFormSubmited = false;

            //FIXME: Name starting with 'toggle' will better describe functionality
            $scope.refreshDefaultUsers = function () {
                $scope.selectedUsersChanged = !$scope.selectedUsersChanged;
            };

            $scope.loading = true;

            var roleId = requestContext.getParam('id');
            var isNew = roleId && roleId === 'create';

            if (!isNew) {
                $scope.role.id = roleId;
                $q.all([
                    $q.when(service.getRole(roleId)),
                    $q.when(service.listUsers()),
                    $q.when(service.listPolicies()),
                    $q.when(Account.getAccount(true))
                ]).then(function (result) {
                    $scope.role = result[0] || {};
                    var users = result[1] || [];
                    var policies = result[2] || [];
                    var account = result[3] || [];
                    policies.forEach(function (item) {
                        item.checked = $scope.role.policies.indexOf(item.name) > -1;
                    });
                    $scope.policyGroups = [
                        {name: account.login + "'s policies", values: policies}
                    ];

                    $scope.role.members.forEach(function (login) {
                        var members = users.filter(function (user) {
                            return user.login === login;
                        });

                        if (members.length) {
                            $scope.roleUsers.push(members[0]);
                        }
                    });

                    $scope.role.default_members.forEach(function (login) {
                        var members = users.filter(function (user) {
                            return user.login === login;
                        });

                        if (members.length) {
                            $scope.roleDefaultUsers.push(members[0]);
                        }
                    });

                    users.forEach(function (user) {
                        user.value = user.login;
                    });

                    $scope.users = users;
                    $scope.refreshDefaultUsers();
                    $scope.loading = false;

                }, function (err) {
                    PopupDialog.errorObj(err);
                });

            } else {
                $q.all([
                    $q.when(service.listUsers()),
                    $q.when(service.listPolicies()),
                    $q.when(Account.getAccount(true))
                ]).then(function (result) {
                    $scope.users = result[0] || [];
                    var policies = result[1] || [];
                    var account = result[2] || [];
                    policies.forEach(function (item) {
                        item.checked = false;
                    });

                    $scope.policyGroups = [
                        {name: account.login + "'s policies", values: policies}
                    ];

                    $scope.users.forEach(function (user) {
                        user.value = user.login;
                    });

                    $scope.loading = false;
                });
            }

            var errorCallback = function (err) {
                $scope.loading = false;
                PopupDialog.errorObj(err);
            };

            var roleAction = function (action) {
                $scope.loading = true;
                $scope.role.members = [];
                $scope.role.default_members = [];
                $scope.role.policies = [];
                $scope.roleUsers.forEach(function (user) {
                    $scope.role.members.push(user.login);
                });

                if (!$scope.roleUsers.length) {
                    $scope.roleDefaultUsers = [];
                }

                $scope.roleDefaultUsers.forEach(function (user) {
                    $scope.role.default_members.push(user.login);
                });
                $scope.policyGroups.forEach(function (group) {
                    group.values.forEach(function (policy) {
                        if (policy.checked) {
                            $scope.role.policies.push(policy.name);
                        }
                    });
                });

                action($scope.role).then(function (role) {
                    $scope.loading = false;
                    $location.path('/accounts/roles');
                }, function (err) {
                    $scope.loading = false;
                    PopupDialog.errorObj(err);
                });

            };

            function isFormInvalid() {
                return $scope.roleForm.$invalid;
            }

            $scope.createRole = function () {
                $scope.isFormSubmited = true;
                if (isFormInvalid()) {
                    return;
                }
                roleAction(service.createRole);
            };
            $scope.updateRole = function () {
                $scope.isFormSubmited = true;
                if (isFormInvalid()) {
                    return;
                }
                roleAction(service.updateRole);
            };
            $scope.deleteRole = function () {
                PopupDialog.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Delete role'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Are you sure you want to delete the selected role ?'
                    ),
                    function () {
                        $scope.loading = true;
                        service.deleteRole($scope.role.id).then(function () {
                            $scope.loading = false;
                            $location.path('/accounts/roles');
                        }, errorCallback);
                    }
                );
            };
            $scope.cancel = function () {
                $location.path('/accounts/roles');
            };
        }
    ]);
}(window.JP.getModule('rbac')));
