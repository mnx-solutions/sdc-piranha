'use strict';

(function (app) {

    app.directive('accountAddSshKey', [
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
                restrict: 'A',
                replace: true,
                scope: true,
                controller: function($scope, $element, $attrs, $transclude) {
                    localization.bind('account', $scope);

                    $scope.downloaded = false;
                },

                link: function ($scope) {
                    $scope.newKey = {};

                    $scope.generateKey = function() {
                        $scope.loading = true;
                        $http.post('/signup/account/ssh/create/')
                            .success(function(data) {
                                if(data.success === true) {
                                    notification.push(null, { type: 'success' },
                                        localization.translate($scope, null,
                                            'SSH Key has been added to your account! <br />You will be prompted for private key download shortly. Please keep your private key safe. <br />Press continue when you are done'
                                        )
                                    );
                                    $scope.downloaded = true;
                                    $scope.iframe = '<iframe class="ssh-download-iframe" src="/signup/account/ssh/download/'+ data.keyId +'/'+ data.name +'" seamless="seamless" style="width: 0px; height: 0px;"></iframe>';
                                    $scope.loading = false;
                                } else {
                                    $scope.loading = false;
                                    // error
                                    notification.push(null, { type: 'error' },
                                        localization.translate($scope, null,
                                            'Unable to generate SSH key: '+ data.err.message
                                        )
                                    );
                                }
                        });
                    };

                    $scope.createNewKey = function() {
                        $scope.loading = true;
                        $scope.addedKey = Account.createKey($scope.newKey.name, $scope.newKey.data);

                        $q.when($scope.addedKey, function(key) {
                            if (key.name && key.fingerprint && key.key) {
                                // successful add
                                $scope.addsshKey = false;
                                $scope.newKey = {};

                                if ($scope.nextStep) {
                                    $scope.nextStep();
                                }
                            } else {

                                $scope.error = localization.translate($scope, null,
                                    'Failed to add new key: {{message}}',
                                    {
                                        message: (key.message || '') + ' ' + (key.code || '')
                                    }
                                );

                            }

                            $scope.loading = false;
                        }, function(key) {
                            $scope.error = localization.translate($scope, null,
                                'Failed to add new key: {{message}}',
                                {
                                    message: (key.message || '') + ' ' + (key.code || '')
                                }
                            );
                            $scope.loading = false;
                        });
                    };


                },
                templateUrl: 'account/static/partials/account-add-ssh-key.html'
            };
        }]);
}(window.JP.getModule('Account')));