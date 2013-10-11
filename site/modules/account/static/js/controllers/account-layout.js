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

            $scope.sshKeys = Account.getKeys();
            $scope.setSshKeys = function(sshs) {
                $scope.sshKeys = sshs;
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