'use strict';

(function (app) {
    app.controller(
        'AccountController',
        ['$scope', '$window', '$q', '$dialog', 'Account', 'localization', 'requestContext', function ($scope, $window, $q, $dialog, Account, localization, requestContext) {
            localization.bind('account', $scope);

            /* taken from the machines controller. Should be made globally available */
            var confirm = function (question, callback) {
                var title = 'Confirm';
                var btns = [{result:'cancel', label: 'Cancel'}, {result:'ok', label: 'OK', cssClass: 'btn-primary'}];

                $dialog.messageBox(title, question, btns)
                    .open()
                    .then(function(result){
                        if(result ==='ok'){
                            callback();
                        }
                    });
            };

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

            /* SSH key creating */
            $scope.createPending = false;
            $scope.addNewKey = function() {
                $scope.createPending = true;
                $scope.addedKey = Account.createKey($scope.newKey.name, $scope.newKey.data);
                $q.when($scope.addedKey, function(key) {

                    if(key.name && key.fingerprint && key.key) {
                        // successful add
                        refreshKeyList();
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

            function refreshKeyList() {
                $scope.sshKeys = Account.getKeys(true);
            }

            /* SSH key deleting */
            $scope.deleteKey = function(name, fingerprint) {
                confirm(localization.translate($scope, null, 'Are you sure you want to delete "'+ name +'" SSH key'), function () {
                    var deleteKey = Account.deleteKey(fingerprint);

                    $q.when(deleteKey, function(data) {
                        refreshKeyList();
                    });
                });
            };

            $scope.showKeygenDownload = function() {
                // these names refer to http://www.w3.org/TR/html5/webappapis.html#dom-navigator-platform
                var supportedPlatforms = ['Linux x86_64', 'Linux i686', 'MacPPC', 'MacIntel'];

                if(supportedPlatforms.indexOf($scope.userPlatform) >= 0) {
                    return true;
                } else {
                    return false;
                }
            };

        }]);
}(window.JP.getModule('Account')));