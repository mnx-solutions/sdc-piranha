'use strict';

(function (app) {

    app.directive('accountSshImport', [
        'Account',
        'localization',
        'notification',
        '$q',
        '$window',
        '$timeout',
        '$http',
        '$rootScope',
        'PopupDialog',
        function (Account, localization, notification, $q, $window, $timeout, $http, $rootScope, PopupDialog) {
            return {
                restrict: 'EA',
                replace: true,
                scope: true,
                controller: function($scope, $element, $attrs, $transclude) {
                    localization.bind('account', $scope);
                },
                link: function ($scope) {
                    /* ssh key creating popup with custom template */
                    $scope.addNewKey = function(question, callback) {
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
                                function uploadFiles(files) {
                                    $rootScope.loading = true;
                                    var data = new FormData();
                                    var xhr = new XMLHttpRequest();
                                    xhr.onreadystatechange = function () {
                                        if (xhr.readyState !== 4) {
                                            return;
                                        }

                                        $scope.$apply(function () {
                                            $scope.keyLoading = false;
                                        });

                                        var response = JSON.parse(xhr.responseText);

                                        if (response.success === true) {
                                            return dialog.close({
                                                keyUploaded: true
                                            });
                                        }
                                        if (response.error) {
                                            var message = response.error.message;

                                            if (response.error.statusCode && response.error.statusCode === 409) {
                                                message = 'Uploaded key is already exists.';
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
                                                ),
                                                function () {}
                                            );
                                        }
                                    };

                                    for (var fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
                                        data.append('uploadInput', files[fileIndex]);
                                    }
                                    data.append('path', elem.value);
                                    $scope.$apply(function () {
                                        $scope.keyLoading = true;
                                    });

                                    xhr.open('POST', 'account/upload');
                                    xhr.send(data);
                                }

                                uploadFiles(elem.files);
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