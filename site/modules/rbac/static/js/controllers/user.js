'use strict';

(function (app) {
    app.controller('rbac.UserController', [
        '$q',
        '$scope',
        'localization',
        '$location',
        'requestContext',
        'BillingService',
        'PopupDialog',
        'rbac.Service',
        'Account',
        function ($q, $scope, localization, $location, requestContext, BillingService, PopupDialog, service, Account) {
            $scope.loading = true;
            $scope.user = {};
            $scope.initial = {};
            $scope.userRoles = [];
            $scope.roles = [];
            $scope.changePassword = {};
            $scope.isFormSubmited = false;
            $scope.noKeysMessage = "User doesn't have any SSH keys";

            var userId = requestContext.getParam('id');

            var errorCallback = function (err) {
                $scope.loading = false;
                if (err && err.message === 'passwordInHistory') {
                    err.message = 'Password was already used';
                }
                PopupDialog.errorObj(err);
            };
            // FIXME: DRY, see orderByLogin in role controller
            var orderByName = function (items) {
                return items.sort(function (a, b) {
                    return a.name.localeCompare(b.name);
                });
            };
            $scope.user.isNew = userId && userId === 'create';
            if (!$scope.user.isNew) {
                $q.all([
                    $q.when(service.getUser(userId)),
                    $q.when(service.listRoles()),
                    $q.when(service.listUserKeys(userId))
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
                    orderByName($scope.roles);
                    $scope.roles.forEach(function (role) {
                        if (role.members.indexOf($scope.user.login) >= 0) {
                            $scope.userRoles.push(role);
                        }
                        role.value = role.id;
                    });
                    $scope.listUserKeys = result[2];
                    $scope.loading = false;
                }, errorCallback);
            } else {
                $q.all([
                    Account.getAccount(),
                    BillingService.getAccountPaymentInfo(),
                    service.listRoles()
                ]).then(function (result) {
                    var account = result[0] || {};
                    $scope.user.companyName = account.companyName;
                    $scope.user.country = account.country;
                    var accountPaymentInfo = result[1] || {};
                    $scope.user.address = accountPaymentInfo.address1;
                    $scope.user.city = accountPaymentInfo.city;
                    $scope.user.state = accountPaymentInfo.state;
                    $scope.user.postalCode = accountPaymentInfo.zipCode;
                    $scope.roles = result[2] || [];
                    orderByName($scope.roles);
                    $scope.roles.forEach(function (item) {
                        item.value = item.id;
                    });
                    if (!account.provisionEnabled) {
                        var submitBillingInfo = {
                            btnTitle: 'Submit and Access Create User'
                        };
                        Account.checkProvisioning(submitBillingInfo, null, null, function (isSuccess) {
                            $scope.loading = false;
                            if (isSuccess) {
                                $location.path('/accounts/user/create');
                            } else {
                                $location.path('/accounts/users');
                            }
                        }, true);
                    } else {
                        $scope.loading = false;
                    }
                }, errorCallback);
            }

            var deleteArrayElement = function (array, item) {
                var pos = array.indexOf(item);
                if (pos > -1) {
                    array.splice(pos, 1);
                }
                return pos;
            };
            var replaceArrayElement = function (array, oldItem, newItem) {
                var pos = array.indexOf(oldItem);
                if (pos > -1) {
                    array[pos] = newItem;
                }
                return pos;
            };

            var replaceRoleMember = function () {
                $scope.userRoles.forEach(function (role) {
                    replaceArrayElement(role.members, $scope.initial.login, $scope.user.login);
                    replaceArrayElement(role.default_members, $scope.initial.login, $scope.user.login);
                });
                $scope.roles.forEach(function (role) {
                    replaceArrayElement(role.members, $scope.initial.login, $scope.user.login);
                    replaceArrayElement(role.default_members, $scope.initial.login, $scope.user.login);
                });
            };

            var updateRolesTasks = function () {
                var updates = [];

                var roleSize = $scope.roles.length;
                var selectedSize = $scope.userRoles.length;
                var i, j, role, index, defaultIndex, selectedRole;
                if ($scope.initial.login && $scope.user.login && $scope.user.login != $scope.initial.login) {
                    replaceRoleMember();
                }
                var member = $scope.user.login;
                for (j = 0; j < roleSize; j++) {
                    role = $scope.roles[j];
                    index = -2;

                    for (i = 0; i < selectedSize; i++) {
                        selectedRole = $scope.userRoles[i];
                        if (role.id === selectedRole.id) {
                            index = role.members.indexOf(member);
                            if (index < 0) {
                                role.members.push(member);
                                role.default_members.push(member);
                                updates.push($q.when(service.updateRole(role)));
                                break;
                            }
                        }
                    }
                    if (index === -2) {
                        index = deleteArrayElement(role.members, member);
                        defaultIndex = deleteArrayElement(role.default_members, member);
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
                service.updateUser($scope.user).then(function () {
                    var updates = updateRolesTasks();
                    $q.all(updates).then(function () {
                        $scope.loading = false;
                        $location.path('/accounts/users');
                    }, errorCallback);
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
