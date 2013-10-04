'use strict';

(function (app) {
    // reverse filter for SSH keys
    app.filter('reverse', function() {
        return function(items) {
            if(items) {
                // return new array in reverse order
                return items.slice().reverse();
            } else {
                return items;
            }
        };
    });


    app.controller('Account.SSHController', [
        '$scope',
        '$window',
        '$timeout',
        '$q',
        '$dialog',
        '$location',
        '$http',
        'Account',
        'localization',
        'requestContext',
        'notification',
        'util',

        function ($scope, $window, $timeout, $q, $dialog, $location, $http, Account, localization, requestContext, notification, util) {
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
                            $http.post('/main/account/ssh/create/', {name: data.keyName})
                                .success(function(data) {
                                    if(data.success === true) {
                                        notification.push(null, { type: 'alert' },
                                            localization.translate($scope, null,
                                                'You will be prompted for private key download shortly. Please keep your private key safe'
                                            )
                                        );
                                        $scope.iframe = '<iframe class="ssh-download-iframe" src="/main/account/ssh/download/'+ data.keyId +'/'+ data.name +'" seamless="seamless" style="width: 0px; height: 0px;"></iframe>';
                                        // start interval
                                        $scope.updateInterval();
                                    } else {
                                        // error
                                        notification.push(null, { type: 'error' },
                                            localization.translate($scope, null,
                                                'Unable to generate SSH key: '+ data.err.message
                                            )
                                        );
                                    }
                            });

                        }
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

            // update keys interval
            $scope.updateInterval = function() {
                var interval = setInterval(function() {
                        $scope.updatedKeys = Account.getKeys(true);
                        $q.all([
                            $q.when($scope.keys),
                            $q.when($scope.updatedKeys)
                        ])
                        .then(function(results) {
                            if(results[0].length !== results[1].length && $scope.openKeyDetails === null) {
                                // keys list have been updated, add it
                                $scope.keys = $scope.updatedKeys;
                                clearInterval(interval);
                                clearTimeout(intervalTimeout);
                            }
                        });
                }, 3000);

                var intervalTimeout = setTimeout(function() {
                    clearInterval(interval);
                }, 5 * 60 * 1000);

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

                        // start interval
                        $scope.updateInterval();

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
                }, function(key) {
                    notification.push(null, { type: 'error' },
                        localization.translate($scope, null,
                            'Failed to add new key: {{message}}',
                            {
                                message: (key.message || '') + ' ' + (key.code || '')
                            }
                        )
                    );
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

                            // start interval
                            $scope.updateInterval();
                        });
                    });
            };

            $scope.updateKeys();



        }]);
}(window.JP.getModule('Account')));