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

    app.controller('account.LayoutController', [
        '$scope',
        'requestContext',
        'localization',
        'notification',
        'Account',
        'BillingService',
        'util',
        '$q',

        function ($scope, requestContext, localization, notification, Account, BillingService, util, $q) {
            requestContext.setUpRenderContext('account', $scope, {
                title: localization.translate(null, 'account', 'Manage My Joyent Account')
            });

            $scope.account = Account.getAccount();
            $scope.setAccount = function (account) {
                $scope.account = account;
            };

            $scope.keys = Account.getKeys();
            $scope.setSshKeys = function(sshs) {
                $scope.keys = sshs;
            };

            $scope.$on('creditCardUpdate', function (event, cc) {
                $scope.creditCard = cc;
            });

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
                            if($scope.updateInterval)
                            {
                                $scope.updateInterval();
                            }
                        });
                    });
            };

            $scope.creditCard = $scope.creditCard || BillingService.getDefaultCreditCard();

        }
    ]);
}(window.JP.getModule('Account')));