'use strict';

(function (app) {

    app.directive('accountSshImport', [
        'Account',
        'localization',
        'http',
        '$rootScope',
        'PopupDialog',
        'requestContext',
        'loggingService',
        'rbac.Service',
        function (Account, localization, http, $rootScope, PopupDialog, requestContext, loggingService, RBAC) {
            return {
                restrict: 'EA',
                replace: true,
                scope: true,
                controller: function ($scope) {
                    localization.bind('account', $scope);
                },
                link: function ($scope) {
                    var subUserId = !$scope.isSubUserForm ? requestContext.getParam('id') : false;
                    Account.getAccount().then(function (account) {
                        if ($scope.isSubUserForm && account.isSubuser) {
                            subUserId = account.id;
                        }
                    });
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

                    function getKeyErrorMessage(sshKey) {
                        var sshKeyExists = false;
                        var message = "The key you've imported is not a public key.";
                        if ($scope.keys.length) {
                            sshKeyExists = $scope.keys.some(function (keyData) {
                                return sshKey === keyData.key.replace(/[\r\n]/g, '');
                            });
                        }
                        if (sshKeyExists) {
                            message = 'This key already exists.';
                        }
                        return message;
                    }

                    var additionalMessage = ' Please try another SSH key.';

                    var errorCallback = function (err) {
                        $rootScope.$broadcast('sshProgress', false);
                        PopupDialog.errorObj(err);
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

                                var files = elem.files;
                                var file = files[0];

                                if (file.size > 1024) {
                                    $rootScope.$broadcast('sshProgress', false);

                                    dialog.close({});
                                    
                                    return showPopupDialog('error', 'Error', "The file you've uploaded is not a public key." + additionalMessage);
                                } else {
                                    var path = 'account/upload';
                                    if (subUserId) {
                                        path = 'account/upload?userId=' +  subUserId;
                                    }
                                    return http.uploadFiles(path, elem.value, files, function (error, result) {
                                        if (result && result.status !== 'success' && result.status !== 'error') {
                                            return;
                                        }
                                        $scope.loadingKeys = false;

                                        if (error) {
                                            var message = error.error;
                                            $rootScope.$broadcast('sshProgress', false);

                                            if (error.status && error.status === 409) {
                                                loggingService.log('info', error.error);
                                                message = 'This key already exists.';
                                            }

                                            dialog.close({});

                                            if (error.status === 403 && error.error) {
                                                message = error.error;
                                                return showPopupDialog('error', 'Error', message);
                                            }
                                            return showPopupDialog('error', 'Error', message + additionalMessage);
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
                                    if (subUserId) {
                                        RBAC.uploadUserKey(subUserId, result.data.keyName, result.data.keyData).then(function () {
                                            $rootScope.$broadcast('sshCreated', true);
                                        }, function (err) {
                                            var message;
                                            if (err && err.name === 'NotAuthorizedError') {
                                                message = err.message;
                                                errorCallback(message);
                                                return;
                                            }
                                            message = getKeyErrorMessage(result.data.keyData);
                                            errorCallback(message + additionalMessage);
                                        });
                                    } else {
                                        $scope.createNewKey({
                                            name: result.data.keyName,
                                            data: result.data.keyData
                                        });
                                    }
                                } else if (result && result.value === 'add' && !result.data.keyData) {
                                    $rootScope.$broadcast('sshProgress', false);
                                    showPopupDialog('error', 'Error', 'Please enter a SSH key.');
                                } else if (result && result.keyUploaded && !subUserId) {
                                    if ($scope.nextStep) {
                                        $scope.skipSsh();
                                    } else {
                                        $scope.updateKeys(true);
                                    }
                                } else if (result && result.keyUploaded && subUserId) {
                                    $rootScope.$broadcast('sshCreated', true);
                                }
                            }
                        );
                    };

                    $scope.createNewKey = function (key) {
                        // If key is not given as an argument but exist in a scope
                        if (!key && $scope.key) {
                            key = $scope.key;
                        }

                        Account.createKey(key.name, key.data).then(
                            function (data) {
                                $rootScope.$broadcast('sshProgress', false);
                                if (data.name && data.fingerprint && data.key) {
                                    $scope.key = null;

                                    if ($scope.nextStep) {
                                        showPopupDialog('message', 'Message', 'SSH Key successfully added to your account.');
                                        $scope.passSsh('/main/');
                                    } else {
                                        $scope.updateKeys(true, function () {
                                            showPopupDialog('message', 'Message', 'New key successfully added.');
                                        });
                                    }
                                } else {
                                    var message = 'Failed to add new key: ' + (data.message || '') + ' ' + (data.code || '') + '.';
                                    showPopupDialog('error', 'Error', message);
                                }

                            },
                            function (err) {
                                $rootScope.$broadcast('sshProgress', false);
                                var message;
                                if (err && err.name === 'NotAuthorizedError') {
                                    message = err.message;
                                    showPopupDialog('error', 'Error', message);
                                    return;
                                }
                                message = getKeyErrorMessage(key.data);
                                showPopupDialog('error', 'Error', message + additionalMessage);
                            }
                        );

                    };
                },
                templateUrl: 'account/static/partials/account-ssh-import.html'
            };
        }]);
}(window.JP.getModule('Account')));