'use strict';

(function (app) {
    app.controller('Account.SSHController', [
        '$scope',
        '$window',
        '$timeout',
        '$q',
        '$dialog',
        '$location',
        'Account',
        'localization',
        'requestContext',
        'notification',
        'util',

        function ($scope, $window, $timeout, $q, $dialog, $location, Account, localization, requestContext, notification, util) {
            requestContext.setUpRenderContext('account.ssh', $scope);
            localization.bind('account', $scope);

            /* ssh key creating popup with custom template */
            var newKeyPopup = function(question, callback) {
                var title = 'Add new ssh key';
                var btns = [{result:'cancel', label:'Cancel', cssClass: 'pull-left'}, {result:'add', label:'Add', cssClass: 'btn-joyent-blue'}];
                var templateUrl = 'account/static/template/dialog/message.html';

                $dialog.messageBox(title, question, btns, templateUrl)
                    .open()
                    .then(function(result) {
                        if(result && result.value === 'add') {
                            callback(result.data);
                        }
                    });
            };

            $scope.sshGenerateUrl = '';

            /* ssh key generating popup with custom template */
            var sshKeyModalCtrl = function($scope, dialog) {
                $scope.keyName = '';

                $scope.close = function(res) {
                    dialog.close(res);
                };

                $scope.generateKey = function() {
                    $scope.close({generate: true, keyName: $scope.keyName});
                };
            };

            var generateKeyPopup = function(question, callback) {
                var title = 'Create SSH Key';
                var btns = [{result:'cancel', label:'Cancel', cssClass: 'pull-left'}];
                var templateUrl = 'account/static/template/dialog/generate-ssh-modal.html';

                $dialog.messageBox(title, question, btns, templateUrl)
                    .open(templateUrl, sshKeyModalCtrl)
                    .then(function(data) {
                        if(data && data.generate === true) {
                            $scope.sshGenerateUrl = '/main/account/ssh'+ ((data.keyName) ? '/'+ data.keyName : '');
                        }
                        // this is here because this will fire on any kind of dialog close
                        $scope.keys = Account.getKeys(true);
                    });
            };


            $scope.key = {};
            $scope.userPlatform = $window.navigator.platform;
            $scope.openKeyDetails = null;

            $scope.setOpenDetails = function(id) {
                if($scope.openKeyDetails === id) {
                    $scope.openKeyDetails = null;
                } else {
                    $scope.openKeyDetails = id;
                }
            };

            /* SSH Key generation popup */
            $scope.generateSshKey = function() {
                generateKeyPopup('', function(keyData){

                });
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

                console.log('Adding key:', key);

                var newKey = Account.createKey(key.name, key.data);

                $q.when(newKey, function (key) {
                    console.log(newKey);
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

            $scope.deleteKey = function (name, fingerprint) {
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
                            $scope.updateKeys();
                        });
                    });
            };

            $scope.updateKeys();

        }]);
}(window.JP.getModule('Account')));