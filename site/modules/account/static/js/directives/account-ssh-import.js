'use strict';

(function (app) {

    app.directive('accountSshImport', [
        'Account',
        'localization',
        'notification',
        '$q',
        '$window',
        '$dialog',
        '$timeout',
        '$http',
        '$rootScope',
        function (Account, localization, notification, $q, $window, $dialog, $timeout, $http, $rootScope) {
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
                        var title = 'Add new ssh key';
                        var btns = [{result:'cancel', label:'Cancel', cssClass: 'pull-left'}, {result:'add', label:'Add', cssClass: 'btn-joyent-blue'}];
                        var templateUrl = 'account/static/template/dialog/message.html';

                        $rootScope.loading = true;
                        $dialog.messageBox(title, question, btns, templateUrl)
                            .open()
                            .then(function(result) {
                                if(result && result.value === 'add') {
                                    $scope.createNewKey({
                                        name: result.data.keyName,
                                        data: result.data.keyData
                                    });
                                } else {
                                    $rootScope.loading = false;
                                }

                                if(result === 'add') {
                                    notification.push(null, { type: 'error' },
                                        localization.translate($scope, null,
                                            'Please enter a SSH key'
                                        )
                                    );
                                }
                            });
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
                                    // show a persistent notification
                                    notification.push(null, { type: 'success', persistent: true },
                                        localization.translate($scope, null,
                                            'SSH Key successfully added to your account'
                                        )
                                    );
                                    $scope.nextStep();
                                } else {
                                    $scope.updateKeys(function() {
                                        notification.push(null, { type: 'success' },
                                            localization.translate($scope, null,
                                                'New key successfully added'
                                            )
                                        );
                                    });
                                }
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
                            $rootScope.loading = false;
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
                },
                templateUrl: 'account/static/partials/account-ssh-import.html'
            };
        }]);
}(window.JP.getModule('Account')));