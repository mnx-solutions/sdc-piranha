'use strict';

(function (app) {
    app.controller('RBAC.UserController', [
        '$q',
        '$scope',
        '$location',
        'requestContext',
        'PopupDialog',
        'Account',
        function ($q, $scope, $location, requestContext, PopupDialog, Account) {
            $scope.loading = true;
            $scope.user = {};
            $scope.userRoles = [];
            $scope.roles = [];

            var userId = requestContext.getParam('id');

            var errorCallback = function (err) {
                $scope.loading = false;
                PopupDialog.errorObj(err);
            };

            $scope.user.isNew = userId && userId === 'create';
            if (!$scope.user.isNew) {
                $q.all([
                    $q.when(Account.getUser(userId)),
                    $q.when(Account.listRoles())
                ]).then(function (result) {
                    $scope.user = result[0];
                    $scope.roles = result[1] || [];
                    $scope.roles.forEach(function (role) {
                        if (role.members.indexOf($scope.user.login) >= 0) {
                            $scope.userRoles.push(role);
                        }
                        role.value = role.id;
                    });
                    $scope.loading = false;
                }, errorCallback);
            } else {
                Account.listRoles().then(function (roles) {
                    $scope.roles = roles || [];
                    $scope.roles.forEach(function (item) {
                        item.value = item.id;
                    });
                    $scope.loading = false;
                }, errorCallback);
            }

            $scope.updateUser = function () {
                $scope.loading = true;
                var updates = [];

                var roleSize = $scope.roles.length;
                var selectedSize = $scope.userRoles.length;
                var i, j, role, index, selectedRole;
                for (j = 0; j < roleSize; j++) {
                    role = $scope.roles[j];
                    index = -2;

                    for (i = 0; i < selectedSize; i++) {
                        selectedRole = $scope.userRoles[i];
                        if (role.id === selectedRole.id) {
                            index = role.members.indexOf($scope.user.login);
                            if (index < 0) {
                                role.members.push($scope.user.login);
                                updates.push($q.when(Account.updateRole(role)));
                                break;
                            }
                        }
                    }
                    if (index === -2) {
                        index = role.members.indexOf($scope.user.login);
                        if (index > -1) {
                            role.members.splice(index, 1);
                            updates.push($q.when(Account.updateRole(role)));
                        }
                    }
                }
                updates.push($q.when(Account.updateUser($scope.user)));
                $q.all(updates).then(function () {
                    $scope.loading = false;
                }, errorCallback);
            };

            $scope.cancel = function () {
                $location.path('/rbac');
            };

            $scope.createUser = function () {
                $scope.loading = true;
                Account.createUser($scope.user).then(function () {
                    $scope.loading = false;
                    $location.path('/rbac');
                }, errorCallback);
            };

            $scope.deleteUser = function () {
                $scope.loading = true;
                Account.deleteUser($scope.user.id).then(function () {
                    $scope.loading = false;
                    $location.path('/rbac');
                }, errorCallback);
            };

            $scope.changeUserPassword = function (password, passwordConfirmation) {
                $scope.loading = true;
                Account.changeUserPassword($scope.user.id, password, passwordConfirmation).then(function () {
                    $scope.loading = false;
                }, errorCallback);
            };

            $scope.cancel = function () {
                $location.path('/rbac');
            };

        }
    ]);
}(window.JP.getModule('Rbac')));