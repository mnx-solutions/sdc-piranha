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
        function (Account, localization, notification, $q, $window, $dialog, $timeout, $http) {
            return {
                restrict: 'EA',
                replace: true,
                scope: true,
                controller: function($scope, $element, $attrs, $transclude) {
                    localization.bind('account', $scope);

                    $scope.loading = false;

                },

                link: function ($scope) {


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

                                if(result === 'add') {
                                    callback(null);
                                }
                            });
                    };

                    $scope.createNewKey = function (key) {
                        $scope.loading = true;
                        // If key is not given as an argument but exist in a scope
                        if (!key && $scope.key) {
                            key = $scope.key;
                        }

                        var newKey = Account.createKey(key.name, key.data);

                        $q.when(newKey, function (key) {
                            $scope.loading = false;
                            if (key.name && key.fingerprint && key.key) {
                                $scope.key = null;

                                // start interval
                                if($scope.updateInterval) {
                                    $scope.updateInterval();
                                }

                                notification.push(null, { type: 'success' },
                                    localization.translate($scope, null,
                                        'New key successfully added'
                                    )
                                );

                                if($scope.nextStep) {
                                    $scope.nextStep();
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
                            $scope.loading = false;
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

                },
                templateUrl: 'account/static/partials/account-ssh-import.html'
            };
        }]);
}(window.JP.getModule('Account')));