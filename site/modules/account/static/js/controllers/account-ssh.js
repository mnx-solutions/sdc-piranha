'use strict';

(function (app) {

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

            $scope.updateKeys();

        }]);
}(window.JP.getModule('Account')));