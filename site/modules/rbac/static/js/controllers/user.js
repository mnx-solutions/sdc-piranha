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
        'Account',
        'http',
        function ($q, $scope, localization, $location, requestContext, PopupDialog, service, Account, http) {
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
                    $scope.roles.sort(function (a, b) {
                        return a.name.localeCompare(b.name);
                    });
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

            var getKeysList = function () {
                service.listUserKeys($scope.user.id).then(function (list) {
                    $scope.listUserKeys = list;
                    $scope.loading = false;
                }, errorCallback);
            };

            $scope.addNewKey = function () {
                var userId = $scope.user.id;
                function showPopupDialog(level, title, message, callback) {
                    return PopupDialog[level](
                        title ? localization.translate(
                            $scope,
                            null,
                            title
                        ) : null,
                        message ? localization.translate(
                            $scope,
                            null,
                            message
                        ) : null,
                        callback
                    );
                }

                var addKeyCtrl = function ($scope, dialog) {
                    $scope.isUploadSshEnabled = $scope.features.uploadSshKey === 'enabled';
                    $scope.data = {};
                    $scope.filePath = '';
                    $scope.close = function (res) {
                        if (res === 'cancel') {
                            dialog.close({
                                value: res
                            });
                            return;
                        }
                        dialog.close({
                            value: 'add',
                            data: {
                                keyName: $scope.data.keyName,
                                keyData: $scope.data.keyData
                            }
                        });
                    };

                    $scope.buttons = [
                        {
                            result: 'cancel',
                            label: 'Cancel',
                            cssClass: 'pull-left',
                            setFocus: false
                        },
                        {
                            result: 'add',
                            label: 'Add',
                            cssClass: '',
                            setFocus: true
                        }
                    ];

                    $scope.uploadFile = function (elem) {
                        $scope.$apply(function () {
                            $scope.loading = true;
                            $scope.keyLoading = true;
                        });
                        var files = elem.files;
                        var file = files[0];

                        if (file.size > 512) {
                            $scope.loading = false;
                            $scope.keyLoading = false;

                            dialog.close({});

                            return showPopupDialog('error', 'Error', "The file you've uploaded is not a public key.");
                        } else {
                            http.uploadFiles('account/upload?userId=' +  userId, elem.value, files, function (error, response) {
                                $scope.loading = false;
                                $scope.keyLoading = false;
                                getKeysList();
                                if (error) {
                                    var message = error.error;

                                    if (error.status && error.status === 409) {
                                        message = 'Uploaded key already exists.';
                                    }

                                    dialog.close({});

                                    return showPopupDialog('error', 'Error', message);
                                }

                                return dialog.close({
                                    keyUploaded: true
                                });
                            });
                        }
                    };
                };

                var opts = {
                    title: 'Add new ssh key',
                    templateUrl: 'account/static/template/dialog/message.html',
                    openCtrl: addKeyCtrl
                };

                PopupDialog.custom(
                    opts,
                    function (result) {
                        if (result && result.value === 'add' && result.data.keyData) {
                            if (!result.data.keyName) {
                                var keyParts = result.data.keyData.split(' ');
                                if (keyParts[2]) {
                                    result.data.keyName = keyParts[2];
                                }
                            }
                            $scope.loading = true;
                            service.uploadUserKey($scope.user.id, result.data.keyName, result.data.keyData).then(function () {
                                getKeysList();
                            }, errorCallback);
                        } else if (result && result.value === 'add' && !result.data.keyData) {
                            $scope.loading = false;
                            return showPopupDialog('error', 'Error', 'Please enter a SSH key.');
                        } else if (result && result.keyUploaded) {
                            $scope.loading = false;
                        }
                    }
                );
            };

            $scope.deleteKey = function (name, key) {
                PopupDialog.confirm(null,
                    localization.translate($scope, null, 'Are you sure you want to delete "{{name}}" SSH key?', {name: name}),
                    function () {
                        $scope.loading = true;
                        service.deleteUserKey($scope.user.id, name, key).then(function () {
                            getKeysList();
                            PopupDialog.message(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Message'
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    'Key successfully deleted.'
                                ),
                                function () {}
                            );
                        }, errorCallback);
                    });
            };

            $scope.$on('sshCreated', function () {
                getKeysList();
            });
            $scope.$on('sshCreating', function () {
                $scope.loading = true;
            });
            $scope.$on('sshCancel', function () {
                $scope.loading = false;
            });
        }
    ]);
}(window.JP.getModule('rbac')));