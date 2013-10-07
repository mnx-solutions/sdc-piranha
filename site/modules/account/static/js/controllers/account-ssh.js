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