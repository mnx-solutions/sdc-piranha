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
                        $rootScope.loading = true;
                        var opts = {
                            title: 'Add new ssh key',
                            btns: [{result: 'cancel', label: 'Cancel', cssClass: 'pull-left', setFocus: false}, {result: 'add', label: 'Add', cssClass: 'btn-joyent-blue', setFocus: true}],
                            templateUrl: 'account/static/template/dialog/message.html'
                        };

                        PopupDialog.custom(
                            opts,
                            function (result) {
                                if (result && result.value === 'add') {
                                    $scope.createNewKey({
                                        name: result.data.keyName,
                                        data: result.data.keyData
                                    });
                                } else {
                                    $rootScope.loading = false;
                                }

                                if (result === 'add') {
                                    PopupDialog.error(
                                        localization.translate(
                                            $scope,
                                            null,
                                            'Error'
                                        ),
                                        localization.translate(
                                            $scope,
                                            null,
                                            'Please enter a SSH key'
                                        ),
                                        function () {}
                                    );
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
                                            'SSH Key successfully added to your account'
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
                                                'New key successfully added'
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
                                        'Failed to add new key: {{message}}',
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
                                    'Failed to add new key: {{message}}',
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