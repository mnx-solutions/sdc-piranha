'use strict';

(function (app) {

    app.directive('accountSshImport', [
        'Account',
        'localization',
        'http',
        '$rootScope',
        'PopupDialog',
        'requestContext',
        'rbac.Service',
        function (Account, localization, http, $rootScope, PopupDialog, requestContext, RBAC) {
            return {
                restrict: 'EA',
                replace: true,
                scope: true,
                controller: function ($scope) {
                    localization.bind('account', $scope);
                },
                link: function ($scope) {
                    var subUser = requestContext.getParam('id') || false;
                    Account.getAccount().then(function (account) {
                        if (account.isSubuser) {
                            subUser = account.id;
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

                            $scope.uploadFile = function (elem) {
                                $scope.$apply(function () {
                                    $rootScope.$broadcast('sshProgress', true);
                                });

                                var files = elem.files;
                                var file = files[0];

                                if (file.size > 512) {
                                    $rootScope.$broadcast('sshProgress', false);

                                    dialog.close({});
                                    
                                    return showPopupDialog('error', 'Error', "The file you've uploaded is not a public key.");
                                } else {
                                    var path = 'account/upload';
                                    if (subUser) {
                                        path = 'account/upload?userId=' +  subUser;
                                    }
                                    return http.uploadFiles(path, elem.value, files, function (error) {
                                        $rootScope.$broadcast('sshProgress', false);

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
                                    if (subUser) {
                                        RBAC.uploadUserKey(subUser, result.data.keyName, result.data.keyData).then(function () {
                                            $rootScope.$broadcast('sshCreated', true);
                                        }, errorCallback);
                                    } else {
                                        $scope.createNewKey({
                                            name: result.data.keyName,
                                            data: result.data.keyData
                                        });
                                    }
                                } else if (result && result.value === 'add' && !result.data.keyData) {
                                    $rootScope.$broadcast('sshProgress', false);
                                    showPopupDialog('error', 'Error', 'Please enter a SSH key.');
                                } else if (result && result.keyUploaded && !subUser) {
                                    if ($scope.nextStep) {
                                        $scope.skipSsh();
                                    } else {
                                        $scope.updateKeys();
                                    }
                                } else if (result && result.keyUploaded && subUser) {
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
                                        $scope.updateKeys(function () {
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
                                var message = 'Failed to add new key: ' + (err.message || '') + ' ' + (err.code || '') + '.';
                                showPopupDialog('error', 'Error', message);

                            }
                        );

                    };
                },
                templateUrl: 'account/static/partials/account-ssh-import.html'
            };
        }]);
}(window.JP.getModule('Account')));