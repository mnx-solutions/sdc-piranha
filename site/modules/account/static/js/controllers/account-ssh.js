'use strict';

(function (app) {
    app.controller('Account.SSHController', [
        '$scope',
        '$window',
        '$timeout',
        '$q',
        '$dialog',
        'Account',
        'localization',
        'requestContext',
        'notification',
        'util',

        function ($scope, $window, $timeout, $q, $dialog, Account, localization, requestContext, notification, util) {
            requestContext.setUpRenderContext('account.ssh', $scope);
            localization.bind('account', $scope);

            /* ssh key creating popup with custom template */
            var newKeyPopup = function(question, callback) {
                var title = 'Add new ssh key';
                var btns = [{result:'cancel', label:'Cancel'}, {result:'add', label:'Add', cssClass: 'btn-primary'}];
                var templateUrl = 'account/static/template/dialog/message.html';

                $dialog.messageBox(title, question, btns, templateUrl)
                    .open()
                    .then(function(result) {
                        if(result.value === 'add') {
                            callback(result.data);
                        }
                    });
            };

            $scope.key = {};
            $scope.userPlatform = $window.navigator.platform;
            $scope.openKeyDetails = null;

            $scope.setOpenDetails = function(id) {
                if(id === $scope.openKeyDetails) {
                    $scope.openKeyDetails = null;
                } else {
                    $scope.openKeyDetails = id;
                }
            };

            /* SSH key creating */
            $scope.addNewKey = function () {
                newKeyPopup('', function (keyData) {
                    if (!keyData) {
                        keyData = {};
                    }

                    if (!keyData.keyData) {
                        notification.push(null, { type: 'error' },
                            localization.translate($scope, null,
                                'Please enter a SSH key'
                            )
                        );

                        return;
                    }

                    $scope.createNewKey({
                        name: keyData.keyName,
                        data: keyData.keyData
                    });
                });
            };

            $scope.updateKeys = function () {
                $scope.keys = Account.getKeys(true);
            };

            $scope.createNewKey = function (key) {
                // If key is not given as an argument but exist in a scope
                if (!key && $scope.key) {
                    key = $scope.key;
                }

                var newKey = Account.createKey(key.name, key.data);

                $q.when(newKey, function (key) {
                    if (key.name && key.fingerprint && key.key) {
                        $scope.key = null;
                        $scope.updateKeys();

                        notification.push(null, { type: 'success' },
                            localization.translate($scope, null,
                                'New key successfully added'
                            )
                        );

                    } else {
                        notification.push(null, { type: 'error' },
                            localization.translate($scope, null,
                                'Failed to add new key: {{message}}',
                                {
                                    message: (key.message || '') + ' ' + (key.code || '')
                                }
                            )
                        );
                    }
                });
            };

            $scope.deleteKey = function(name, fingerprint) {
                util.confirm(null, localization.translate($scope, null,
                    'Are you sure you want to delete "{{name}}" SSH key',
                    {
                        name: name
                    }
                ),
                    function () {
                        var deleteKey = Account.deleteKey(fingerprint);

                        $q.when(deleteKey, function (data) {
                            $scope.openKeyDetails = null;

                            notification.push(null, { type: 'success' },
                                localization.translate($scope, null,
                                    'Key successfully deleted'
                                )
                            );

                            // FIXME: Bad, bad, bad
                            $timeout(function () {
                                $scope.updateKeys();
                            }, 1000);
                        });
                    });
            };

            /*
            $scope.showKeygenDownload = function() {
                // these names refer to http://www.w3.org/TR/html5/webappapis.html#dom-navigator-platform
                var supportedPlatforms = ['Linux x86_64', 'Linux i686', 'MacPPC', 'MacIntel'];
                return (supportedPlatforms.indexOf($scope.userPlatform) >= 0);
            };

            $scope.clickKeygenDownload = function() {
                window.location.href = '/main/account/key-generator.sh';
            };
            */

            $scope.updateKeys();

        }]);
}(window.JP.getModule('Account')));