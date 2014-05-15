'use strict';

(function (app) {

    app.directive('accountSshImport', [
        'Account',
        'localization',
        'notification',
        '$q',
        '$window',
        '$timeout',
        'http',
        '$rootScope',
        'PopupDialog',
        function (Account, localization, notification, $q, $window, $timeout, http, $rootScope, PopupDialog) {
            return {
                restrict: 'EA',
                replace: true,
                scope: true,
                controller: function($scope, $element, $attrs, $transclude) {
                    localization.bind('account', $scope);
                },
                link: function ($scope) {
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
                    /* ssh key creating popup with custom template */
                    $scope.addNewKey = function (question, callback) {
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
                                $rootScope.loading = true;
                            };

                            $scope.buttons = [{result: 'cancel', label: 'Cancel', cssClass: 'pull-left', setFocus: false}, {result: 'add', label: 'Add', cssClass: 'btn-joyent-blue', setFocus: true}];

                            $scope.uploadFile = function (elem) {
                                $scope.$apply(function () {
                                    $rootScope.loading = true;
                                    $scope.keyLoading = true;
                                });

                                var files = elem.files;
                                var file = files[0];

                                if (file.size > 512) {
                                    $rootScope.loading = false;
                                    $scope.keyLoading = false;

                                    dialog.close({});
                                    
                                    return showPopupDialog('error', 'Error', "The file you've uploaded is not a public key.");
                                } else {
                                    http.uploadFiles('account/upload', elem.value, files, function (error, response) {
                                        $rootScope.loading = false;
                                        $scope.keyLoading = false;

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
                                    return $scope.createNewKey({
                                        name: result.data.keyName,
                                        data: result.data.keyData
                                    });
                                } else if (result && result.value === 'add' && !result.data.keyData) {
                                    $rootScope.loading = false;
                                    return showPopupDialog('error', 'Error', 'Please enter a SSH key.');
                                } else if (result && result.keyUploaded) {
                                    if ($scope.nextStep) {
                                        $scope.skipSsh();
                                    } else {
                                        $scope.updateKeys();
                                    }
                                }
                            }
                        );
                    };

                    $scope.createNewKey = function (key) {
                        // If key is not given as an argument but exist in a scope
                        if (!key && $scope.key) {
                            key = $scope.key;
                        }

                        var newKey = Account.createKey(key.name, key.data);

                        $q.when(newKey, function (key) {
                            $rootScope.loading = false;
                            if (key.name && key.fingerprint && key.key) {
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
                                var message = 'Failed to add new key: ' + (key.message || '') + ' ' + (key.code || '') + '.';
                                showPopupDialog('error', 'Error', message);
                            }
                        }, function (key) {
                            $rootScope.loading = false;
                            var message = 'Failed to add new key: ' + (key.message || '') + ' ' + (key.code || '') + '.';
                            showPopupDialog('error', 'Error', message);
                        });
                    };
                },
                templateUrl: 'account/static/partials/account-ssh-import.html'
            };
        }]);
}(window.JP.getModule('Account')));