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

            $scope.$on('ssh-form:onKeyDeleted', function () {
                $scope.openKeyDetails = null;
            });

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