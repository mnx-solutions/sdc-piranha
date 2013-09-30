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

                    $scope.generateSshKey = function() {
                        $scope.sshGenerateUrl = '/main/account/ssh';
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