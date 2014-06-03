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
        function ($q, $location, $scope, PopupDialog, Account, service, requestContext) {
            $scope.role = {};
            $scope.policyGroups = [];
            $scope.users = [];
            $scope.roleUsers = [];
            $scope.roleDefaultUsers = [];
            $scope.selectedUsersChanged = false;

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
                    $q.when(service.listPolicies())
                ]).then(function (result) {
                    $scope.role = result[0] || {};
                    var users = result[1] || [];

                    var policies = result[2] || [];
                    policies.forEach(function (item) {
                        item.checked = $scope.role.policies.indexOf(item.name) > -1;
                    });
                    $scope.policyGroups = [
                        {name: 'Miscellaneous', values: policies}
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
                    $q.when(service.listPolicies())
                ]).then(function (result) {
                    $scope.users = result[0] || [];
                    var policies = result[1] || [];
                    policies.forEach(function (item) {
                        item.checked = false;
                    });

                    $scope.policyGroups = [
                        {name: 'Miscellaneous', values: policies}
                    ];

                    $scope.users.forEach(function (user) {
                        user.value = user.login;
                    });

                    $scope.loading = false;
                });
            }

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
                    $location.path('/rbac/roles');
                }, function (err) {
                    $scope.loading = false;
                    PopupDialog.errorObj(err);
                });

            };

            $scope.createRole = function () {
                roleAction(service.createRole);
            };
            $scope.updateRole = function () {
                roleAction(service.updateRole);
            };
            $scope.cancel = function () {
                $location.path('/rbac/roles');
            };
        }
    ]);
}(window.JP.getModule('rbac')));
