'use strict';

(function (app) {

    app.directive('accountSshImport', [
        'Account',
        'localization',
        'http',
        '$rootScope',
        'PopupDialog',
        'loggingService',
        'rbac.Service',
        function (Account, localization, http, $rootScope, PopupDialog, loggingService, RBAC) {
            return {
                restrict: 'EA',
                replace: true,
                scope: true,
                controller: function ($scope) {
                    localization.bind('account', $scope);
                },
                link: function ($scope) {
                    var ADDITIONAL_MESSAGE = ' Please try another SSH key.';
                    Account.assignSubUserId($scope);

                    var getKeyErrorMessage = function (sshKey, keyName) {
                        var sshKeyExists = false;
                        var sshKeyNameExists = false;
                        var message = "The key you've imported is not a public key.";
                        if ($scope.keys.length) {
                            sshKeyExists = $scope.keys.some(function (keyData) {
                                return sshKey === keyData.key.replace(/[\r\n]/g, '');
                            });
                            if (!sshKeyExists) {
                                sshKeyNameExists = $scope.keys.some(function (keyData) {
                                    return keyName === keyData.name;
                                });
                            }
                        }

                        if (sshKeyExists) {
                            message = 'This key already exists.';
                        } else if (sshKeyNameExists) {
                            message = 'The ssh key named "' + keyName + '" already exists.'
                        }
                        return message;
                    };

                    var errorCallback = function (err) {
                        $rootScope.$broadcast('sshProgress', false);
                        PopupDialog.errorObj(err);
                    };

                    var uploadSubUserKey = function (key) {
                        RBAC.uploadUserKey($scope.subUserId, key.name, key.data).then(function () {
                            $rootScope.$broadcast('sshCreated', true);
                        }, function (err) {
                            var message;
                            if (err && err.name === 'NotAuthorizedError') {
                                message = err.message;
                                errorCallback(message);
                                return;
                            }
                            message = getKeyErrorMessage(key.data, key.name);
                            errorCallback(message + ADDITIONAL_MESSAGE);
                        });
                    };

                    var addUserKeyData = function (result) {
                        if (!result.data.keyName) {
                            var keyParts = result.data.keyData.split(' ');
                            if (keyParts[2]) {
                                result.data.keyName = keyParts[2];
                            }
                        }
                        var key = {
                            name: result.data.keyName,
                            data: result.data.keyData
                        };
                        if ($scope.subUserId) {
                            uploadSubUserKey(key);
                        } else {
                            $scope.createNewKey(key);
                        }
                    };

                    var addNewKeyModalCallback = function (result) {
                        if (!result) {
                            $rootScope.$broadcast('sshProgress', false);
                            return;
                        }
                        if (result.value === 'add' && result.data.keyData) {
                            addUserKeyData(result);
                        } else if (result.value === 'add' && !result.data.keyData) {
                            $rootScope.$broadcast('sshProgress', false);
                            Account.showPopupDialog($scope, 'error', 'Error', 'Please enter a SSH key.');
                        } else if (result.keyUploaded && !$scope.subUserId) {
                            if ($scope.nextStep) {
                                $scope.skipSsh();
                            } else {
                                $scope.updateKeys(true);
                            }
                        } else if (result.keyUploaded && $scope.subUserId) {
                            $rootScope.$broadcast('sshCreated', true);
                        }
                    };

                    var uploadFile = function (dialog, elem) {
                        var files = elem.files;
                        var file = files[0];

                        if (file.size > 1024) {
                            $rootScope.$broadcast('sshProgress', false);
                            dialog.close({});
                            return Account.showPopupDialog($scope, 'error', 'Error', 'The file you\'ve uploaded is not a public key.' + ADDITIONAL_MESSAGE);
                        } else {
                            var path = 'account/upload';
                            if ($scope.subUserId) {
                                path = 'account/upload?userId=' + $scope.subUserId;
                            }
                            return http.uploadFiles(path, elem.value, files, null, function (error, result) {
                                $scope.loadingKeys = false;
                                if (result && result.status !== 'success' && result.status !== 'error') {
                                    return;
                                }

                                if (error) {
                                    var message = error.error;
                                    $rootScope.$broadcast('sshProgress', false);

                                    if (error.status === 409) {
                                        loggingService.log('info', error.error);
                                        message = 'This key already exists.';
                                    }

                                    dialog.close({});

                                    if (error.status === 403 && error.error) {
                                        message = error.error;
                                        return Account.showPopupDialog($scope, 'error', 'Error', message);
                                    }
                                    return Account.showPopupDialog($scope, 'error', 'Error', message + ADDITIONAL_MESSAGE);
                                }

                                return dialog.close({
                                    keyUploaded: true
                                });
                            });
                        }
                    };

                    /* ssh key creating popup with custom template */
                    $scope.addNewKey = function () {
                        var addKeyCtrl = function ($scope, dialog) {
                            $scope.isUploadSshEnabled = $rootScope.features.uploadSshKey === 'enabled';
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
                                $rootScope.$broadcast('sshProgress', true);
                            };

                            $scope.buttons = [{result: 'cancel', label: 'Cancel', cssClass: 'pull-left', setFocus: false}, {result: 'add', label: 'Add', cssClass: 'btn-joyent-blue', setFocus: true}];

                            $scope.loadingKeys = false;

                            $scope.uploadFile = function (elem) {
                                $scope.loadingKeys = true;
                                $scope.$apply(function () {
                                    $rootScope.$broadcast('sshProgress', true);
                                });
                                uploadFile(dialog, elem);
                            };
                        };

                        var opts = {
                            title: 'Add new ssh key',
                            templateUrl: 'account/static/template/dialog/message.html',
                            openCtrl: addKeyCtrl
                        };

                        PopupDialog.custom(opts, addNewKeyModalCallback);
                    };

                    $scope.createNewKey = function (key) {
                        // If key is not given as an argument but exist in a scope
                        if (!key && $scope.key) {
                            key = $scope.key;
                        }

                        Account.createKey(key.name, key.data).then(function (data) {
                            $rootScope.$broadcast('sshProgress', false);
                            if (data.name && data.fingerprint && data.key) {
                                $scope.key = null;

                                if ($scope.nextStep) {
                                    Account.showPopupDialog($scope, 'message', 'Message', 'SSH Key successfully added to your account.');
                                    $scope.passSsh('/main/');
                                } else {
                                    $scope.updateKeys(true, function () {
                                        Account.showPopupDialog($scope, 'message', 'Message', 'New key successfully added.');
                                    });
                                }
                            } else {
                                var message = 'Failed to add new key: ' + (data.message || '') + ' ' + (data.code || '') + '.';
                                Account.showPopupDialog($scope, 'error', 'Error', message);
                            }

                        }, function (err) {
                            $rootScope.$broadcast('sshProgress', false);
                            var message;
                            if (err && err.name === 'NotAuthorizedError') {
                                message = err.message;
                                return Account.showPopupDialog($scope, 'error', 'Error', message);
                            }
                            message = getKeyErrorMessage(key.data, key.name);
                            Account.showPopupDialog($scope, 'error', 'Error', message + ADDITIONAL_MESSAGE);
                        });
                    };
                },
                templateUrl: 'account/static/partials/account-ssh-import.html'
            };
        }]);
}(window.JP.getModule('Account')));