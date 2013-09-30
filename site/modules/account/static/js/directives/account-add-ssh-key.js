'use strict';

(function (app) {

    app.directive('accountAddSshKey', [
        'Account',
        'localization',
        '$q',
        '$window',
        function (Account, localization, $q, $window) {
            return {
                restrict: 'A',
                replace: true,
                scope: true,

                controller: function($scope, $element, $attrs, $transclude) {
                    localization.bind('account', $scope);
                },

                link: function ($scope) {
                    $scope.key = {};

                    /* ssh key generating popup with custom template */
                    var sshKeyModalCtrl = function($scope, dialog) {
                        $scope.keyName = '';

                        $scope.close = function(res) {
                            dialog.close(res);
                        };

                        $scope.generateKey = function() {
                            $scope.close($scope.keyName);
                        }
                    };

                    var generateKeyPopup = function(question, callback) {
                        var title = 'Create SSH Key';
                        var btns = [{result:'cancel', label:'Cancel', cssClass: 'pull-left'}];
                        var templateUrl = 'account/static/template/dialog/generate-ssh-modal.html';

                        $dialog.messageBox(title, question, btns, templateUrl)
                            .open(templateUrl, sshKeyModalCtrl)
                            .then(function(data) {

                                $scope.sshGenerateUrl = '/main/account/ssh'+ ((data) ? '/'+ data : '');
                                // this is here because this will fire on any kind of dialog close
                                $scope.keys = Account.getKeys(true);
                            });
                    };

                    $scope.generateSshKey = function() {
                        generateKeyPopup('', function(keyData){

                        });
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

                },
                templateUrl: 'account/static/partials/account-add-ssh-key.html'
            };
        }]);
}(window.JP.getModule('Account')));