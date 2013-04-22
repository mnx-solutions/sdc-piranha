'use strict';

(function (app) {
    app.controller(
        'AccountController',
        ['$scope', '$window', '$q', 'Account', 'localization', 'requestContext', function ($scope, $window, $q, Account, localization, requestContext) {
            localization.bind('account', $scope);

            $scope.account = Account.getAccount();
            $scope.updateable = ['email','firstName','lastName','companyName','address','postalCode','city','state','country','phone'];
            $scope.sshKeys = Account.getKeys();

            $scope.userPlatform = $window.navigator.platform;

            $scope.newKey = {};

            $scope.openKeyDetails = null;
            $scope.setOpenDetails = function(id) {
                if(id === $scope.openKeyDetails) {
                    $scope.openKeyDetails = null;
                } else {
                    $scope.openKeyDetails = id;
                }
            };

            $scope.createPending = false;
            $scope.addNewKey = function() {
                $scope.createPending = true;
                $scope.addedKey = Account.createKey($scope.newKey.name, $scope.newKey.data);
                $q.when($scope.addedKey, function(key) {

                    if(key.name && key.fingerprint && key.key) {
                        // successful add
                        $scope.sshKeys = Account.getKeys();
                        $scope.addsshKey = false;

                        $scope.newKey = {};
                    }
                    $scope.createPending = false;
                });
            };

            $scope.saving = false;

            $scope.updateAccount = function () {
                console.log('here');
                $scope.saving = true;
                Account.updateAccount($scope.account).then(function (newAccount) {
                    $scope.account = newAccount;
                    $scope.saving = false;
                }, function (err) {
                    $scope.saving = false;
                });

            };
        }]);
}(window.JP.getModule('Account')));