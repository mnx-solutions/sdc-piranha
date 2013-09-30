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
                    $scope.newKey = {};

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
                        });
                    };


                },
                templateUrl: 'account/static/partials/account-add-ssh-key.html'
            };
        }]);
}(window.JP.getModule('Account')));