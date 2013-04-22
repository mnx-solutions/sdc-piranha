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
            $scope.sshKeys = Account.getKeys();

            $scope.userPlatform = $window.navigator.platform;

            $scope.newKey = {};

            $scope.openKeyDetails = null;
            $scope.setOpenDetails = function(id) {
                if(id == $scope.openKeyDetails) {
                    $scope.openKeyDetails = null;
                } else {
                    $scope.openKeyDetails = id;
                }
            }

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
                })
            }

            /* SSH key deleting */
            $scope.deleteKey = function(name, fingerprint) {
                confirm(localization.translate($scope, null, 'Are you sure you want to delete "'+ name +'" SSH key'), function () {
                    var deleteKey = Account.deleteKey(fingerprint);

                    $q.when(deleteKey, function(data) {
                        refreshKeyList();
                    });
                });
            }


            function refreshKeyList() {
                $scope.sshKeys = Account.getKeys(true);
            }
        }]);
}(window.JP.getModule('Account')));