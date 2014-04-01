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
        'PopupDialog',
        '$q',
        '$http',
        '$rootScope',

        function ($scope, requestContext, localization, notification, Account, BillingService, PopupDialog, $q, $http, $rootScope) {
            requestContext.setUpRenderContext('account', $scope, {
                title: localization.translate(null, 'account', 'Manage My Joyent Account')
            });

            $scope.account = Account.getAccount();
            $scope.setAccount = function (account) {
                $scope.account = account;
            };

            $scope.updateKeys = function (cb) {
                $scope.loadingKeys = true;
                $scope.keys = Account.getKeys(true);

                $q.when($scope.keys).then(function() {
                    $scope.loadingKeys = false;

                    if(typeof cb === 'function') {
                        cb();
                    }
                });
            };

            $scope.updateKeys();

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

            $scope.deleteKey = function (name, fingerprint, $event) {
                $event.stopPropagation();
                PopupDialog.confirm(null,
                    localization.translate($scope, null, 'Are you sure you want to delete "{{name}}" SSH key?', {name: name}),
                    function () {
                        $scope.loading = true;
                        $scope.keys = null;
                        $scope.loadingKeys = true;
                        var deleteKey = Account.deleteKey(fingerprint);

                        $q.when(deleteKey, function () {
                            $scope.updateKeys(function () {
                                $scope.loading = false;
                                $scope.openKeyDetails = null;
                                if ($rootScope.downloadLink && $rootScope.downloadLink.indexOf(fingerprint) !== -1) {
                                    $rootScope.downloadLink = null;
                                }

                                PopupDialog.message(
                                    localization.translate(
                                        $scope,
                                        null,
                                        'Message'
                                    ),
                                    localization.translate(
                                        $scope,
                                        null,
                                        'Key successfully deleted.'
                                    ),
                                    function () {}
                                );
                            });
                        });
                    });
            };

            $scope.creditCard = $scope.creditCard || BillingService.getDefaultCreditCard();

            $scope.getKeyName = function (key) {
                if (key.name === key.fingerprint) {
                    return key.name.split(':').splice(-5).join('');
                }
                return key.name || '';
            };

        }
    ]);
}(window.JP.getModule('Account')));