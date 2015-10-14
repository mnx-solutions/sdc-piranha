'use strict';

(function (app) {
    app.controller('rbac.UserController', [
        '$q',
        '$scope',
        '$http',
        'loggingService',
        'localization',
        '$location',
        'requestContext',
        'BillingService',
        'PopupDialog',
        'rbac.Service',
        'rbac.User',
        'Account',
        'util',
        function ($q, $scope, $http, loggingService, localization, $location, requestContext, BillingService, PopupDialog, service, RbacUser, Account, util) {
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
                if (err && err.message.toLowerCase().indexOf('login') !== -1) {
                    err.message = 'This username is already in use.';
                }
                if (err && err.message.toLowerCase().indexOf('email') !== -1) {
                    err.message = 'This email address is already in use.';
                }
                PopupDialog.errorObj(err);
                if (err.statusCode === 404) {
                    service.updateCache({ids: [userId]}, {}, 'user', service.ACCESS.WRITE);
                    $location.path('/accounts/users');
                }
            };

            var fillCountryNameFromCode = function () {
                $scope.countries = $http.get('account/countries');
                $scope.countries.then(function (countries) {
                    var country = countries.data.find(function (country) {
                        return country.iso3 === $scope.user.country;
                    });
                    $scope.user.countryName = country && country.name;
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
                    fillCountryNameFromCode();
                    $scope.initial.firstName = $scope.user.firstName;
                    $scope.initial.lastName = $scope.user.lastName;
                    $scope.initial.login = $scope.user.login;
                    $scope.initial.companyName = $scope.user.companyName;
                    $scope.initial.postalCode = $scope.user.postalCode;
                    $scope.initial.address = $scope.user.address;
                    $scope.initial.city = $scope.user.city;
                    $scope.roles = result[1] || [];
                    util.orderBy('name', $scope.roles);
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
                Account.getAccount().then(function (account) {
                    $scope.user.companyName = account.companyName;
                    $scope.user.country = account.country.iso3 || account.country;
                    if (!account.country.iso3) {
                        fillCountryNameFromCode();
                    } else {
                        $scope.user.countryName = account.country.name;
                    }
                    if (!account.provisionEnabled) {
                        var submitBillingInfo = {
                            btnTitle: 'Submit and Access Create User'
                        };
                        Account.checkProvisioning(submitBillingInfo, null, function (isSuccess) {
                            $scope.loading = false;
                            if (isSuccess) {
                                $location.path('/accounts/user/create');
                            } else {
                                $location.path('/accounts/users');
                            }
                        }, true);
                    } else if ($scope.features.billing === 'enabled') {
                        BillingService.getAccountPaymentInfo().then(function (accountPaymentInfo) {
                            $scope.user.address = accountPaymentInfo.address1;
                            $scope.user.city = accountPaymentInfo.city;
                            $scope.user.state = accountPaymentInfo.state;
                            $scope.user.postalCode = accountPaymentInfo.zipCode;
                        });
                        $scope.loading = false;
                    } else {
                        $scope.loading = false;
                    }
                });
                service.listRoles().then(function (roles) {
                    $scope.roles = roles || [];
                    util.orderBy('name', $scope.roles);
                    $scope.roles.forEach(function (item) {
                        item.value = item.id;
                    });
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

            $scope.isInvalid = function () {
                return $scope.subAccountForm && $scope.subAccountForm.$invalid;

            };

            $scope.createUser = function () {
                $scope.isFormSubmited = true;
                if ($scope.isInvalid()) {
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
                if ($scope.isInvalid()) {
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
                        service.listUserKeys($scope.user.id).then(function (list) {
                            $scope.listUserKeys = list;
                            if ($scope.listUserKeys.length !== 0) {
                                var message = 'Cannot delete user with SSH keys. Please delete SSH keys first.';
                                loggingService.log('info', message);
                                errorCallback({message: message});
                                return;
                            }
                            service.deleteUser($scope.user.id).then(function () {
                                $scope.loading = false;
                                $location.path('/accounts/users');
                            }, errorCallback);
                        }, errorCallback);
                    }
                );
            };

            $scope.cancel = function () {
                $location.path('/accounts/users');
            };

            $scope.changeUserPassword = function () {
                RbacUser.changeUserPassword($scope.user.id, $scope);
            };
        }
    ]);
}(window.JP.getModule('rbac')));
