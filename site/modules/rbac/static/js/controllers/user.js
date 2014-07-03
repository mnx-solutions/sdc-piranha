'use strict';

(function (app) {
    app.controller('rbac.UserController', [
        '$q',
        '$scope',
        'localization',
        '$location',
        'requestContext',
        'PopupDialog',
        'rbac.Service',
        function ($q, $scope, localization, $location, requestContext, PopupDialog, service) {
            $scope.loading = true;
            $scope.user = {};
            $scope.initial = {};
            $scope.userRoles = [];
            $scope.roles = [];
            $scope.changePassword = {};
            $scope.isFormSubmited = false;

            var userId = requestContext.getParam('id');

            var errorCallback = function (err) {
                $scope.loading = false;
                if (err && err.message === 'passwordInHistory') {
                    err.message = 'Password was already used';
                }
                PopupDialog.errorObj(err);
            };

            $scope.user.isNew = userId && userId === 'create';
            if (!$scope.user.isNew) {
                $q.all([
                    $q.when(service.getUser(userId)),
                    $q.when(service.listRoles())
                ]).then(function (result) {
                    $scope.user = angular.copy(result[0]);
                    $scope.initial.firstName = $scope.user.firstName;
                    $scope.initial.lastName = $scope.user.lastName;
                    $scope.initial.login = $scope.user.login;
                    $scope.initial.companyName = $scope.user.companyName;
                    $scope.initial.postalCode = $scope.user.postalCode;
                    $scope.initial.address = $scope.user.address;
                    $scope.initial.city = $scope.user.city;
                    $scope.roles = result[1] || [];
                    $scope.roles.sort(function (a, b) {
                        return a.name.localeCompare(b.name);
                    });
                    $scope.roles.forEach(function (role) {
                        if (role.members.indexOf($scope.user.login) >= 0) {
                            $scope.userRoles.push(role);
                        }
                        role.value = role.id;
                    });
                    $scope.loading = false;
                }, errorCallback);
            } else {
                service.listRoles().then(function (roles) {
                    $scope.roles = roles || [];
                    $scope.roles.forEach(function (item) {
                        item.value = item.id;
                    });
                    $scope.loading = false;
                }, errorCallback);
            }

            var deleteByElement = function (array, item) {
                var pos = array.indexOf(item);
                if (pos > -1) {
                    array.splice(pos, 1);
                }
                return pos;
            };

            var updateRolesTasks = function () {
                var updates = [];

                var roleSize = $scope.roles.length;
                var selectedSize = $scope.userRoles.length;
                var i, j, role, index, defaultIndex, selectedRole;

                for (j = 0; j < roleSize; j++) {
                    role = $scope.roles[j];
                    index = -2;

                    for (i = 0; i < selectedSize; i++) {
                        selectedRole = $scope.userRoles[i];
                        if (role.id === selectedRole.id) {
                            index = role.members.indexOf($scope.user.login);
                            if (index < 0) {
                                role.members.push($scope.user.login);
                                updates.push($q.when(service.updateRole(role)));
                                break;
                            }
                        }
                    }
                    if (index === -2) {
                        index = deleteByElement(role.members, $scope.user.login);
                        defaultIndex = deleteByElement(role.default_members, $scope.user.login);
                        if (index > -1 || defaultIndex > -1) {
                            updates.push($q.when(service.updateRole(role)));
                        }
                    }
                }
                return updates;
            };

            var isFieldsInvalid = function () {
                return $scope.subAccountForm.$invalid;

            };

            $scope.createUser = function () {
                $scope.isFormSubmited = true;
                if (isFieldsInvalid()) {
                    return;
                }
                $scope.loading = true;
                service.createUser($scope.user).then(function () {
                    var updates = updateRolesTasks();
                    $q.all(updates).then(function () {
                        $scope.loading = false;
                        $location.path('/accounts/users');
                    }, errorCallback);
                }, errorCallback);
            };

            $scope.updateUser = function () {
                $scope.isFormSubmited = true;
                if (isFieldsInvalid()) {
                    return;
                }
                $scope.loading = true;
                var updates = updateRolesTasks();
                updates.push($q.when(service.updateUser($scope.user)));
                $q.all(updates).then(function () {
                    $scope.loading = false;
                    $location.path('/accounts/users');
                }, errorCallback);
            };

            $scope.deleteUser = function () {
                PopupDialog.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Delete user'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Are you sure you want to delete the selected user?'
                    ),
                    function () {
                        $scope.loading = true;
                        service.deleteUser($scope.user.id).then(function () {
                            $scope.loading = false;
                            $location.path('/accounts/users');
                        }, errorCallback);
                    }
                );
            };

            $scope.cancel = function () {
                $location.path('/accounts/users');
            };

            $scope.changeUserPassword = function () {
                $scope.isPassFormSubmited = true;
                var opts = {
                    templateUrl: 'rbac/static/partials/change-password.html',
                    openCtrl: function ($scope, dialog) {
                        $scope.buttons = [
                            {
                                result: 'cancel',
                                label: 'Cancel',
                                cssClass: 'grey-new effect-orange-button',
                                setFocus: false
                            },
                            {
                                result: 'ok',
                                label: 'Change Password',
                                cssClass: 'orange',
                                setFocus: false
                            }
                        ];
                        $scope.buttonClick = function (passwords, res) {
                            if (!res || (res && res !== 'ok')) {
                                dialog.close();
                            } else {
                                if ($scope.passForm.$invalid) {
                                    return;
                                }
                                dialog.close(passwords);
                            }
                        };
                        $scope.removeErrors = function () {
                            $scope.lengthError = $scope.charactersError = $scope.repeatError = false;
                        };
                    }
                };
                PopupDialog.custom(
                    opts,
                    function (passwords) {
                        $scope.loading = !!passwords;
                        if (passwords) {
                            service.changeUserPassword($scope.user.id, passwords[0], passwords[1]).then(function () {
                                $scope.loading = false;
                            }, errorCallback);
                        }
                    }
                );

            };
        }
    ]);
}(window.JP.getModule('rbac')));