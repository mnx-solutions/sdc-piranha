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

                                http.uploadFiles('account/upload', elem.value, elem.files, function (error, response) {
                                    $scope.keyLoading = false;

                                    if (error) {
                                        var message = error.error;

                                        if (error.status && error.status === 409) {
                                            message = 'Uploaded key already exists.';
                                        }

                                        dialog.close({});

                                        $rootScope.loading = false;

                                        return PopupDialog.error(
                                            localization.translate(
                                                $scope,
                                                null,
                                                'Error'
                                            ),
                                            localization.translate(
                                                $scope,
                                                null,
                                                message
                                            )
                                        );
                                    }

                                    return dialog.close({
                                        keyUploaded: true
                                    });
                                });
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
                                    return PopupDialog.error(
                                        localization.translate(
                                            $scope,
                                            null,
                                            'Error'
                                        ),
                                        localization.translate(
                                            $scope,
                                            null,
                                            'Please enter a SSH key.'
                                        ),
                                        function () {}
                                    );
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

                                if($scope.nextStep) {
                                    PopupDialog.message(
                                        localization.translate(
                                            $scope,
                                            null,
                                            'Message'
                                        ),
                                        localization.translate(
                                            $scope,
                                            null,
                                            'SSH Key successfully added to your account.'
                                        ),
                                        function () {}
                                    );
                                    $scope.nextStep();
                                } else {
                                    $scope.updateKeys(function() {
                                        PopupDialog.message(
                                            localization.translate(
                                                $scope,
                                                null,
                                                'Message'
                                            ),
                                            localization.translate(
                                                $scope,
                                                null,
                                                'New key successfully added.'
                                            ),
                                            function () {}
                                        );
                                    });
                                }
                            } else {
                                PopupDialog.error(
                                    localization.translate(
                                        $scope,
                                        null,
                                        'Error'
                                    ),
                                    localization.translate(
                                        $scope,
                                        null,
                                        'Failed to add new key: {{message}}.',
                                        {
                                            message: (key.message || '') + ' ' + (key.code || '')
                                        }
                                    ),
                                    function () {}
                                );
                            }
                        }, function(key) {
                            $rootScope.loading = false;
                            PopupDialog.error(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Error'
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    'Failed to add new key: {{message}}.',
                                    {
                                        message: (key.message || '') + ' ' + (key.code || '')
                                    }
                                ),
                                function () {}
                            );
                        });
                    };
                },
                templateUrl: 'account/static/partials/account-ssh-import.html'
            };
        }]);
}(window.JP.getModule('Account')));