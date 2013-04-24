'use strict';

(function (app) {
    app.controller(
        'Account.SSHController',
        ['$scope', '$window', '$q', '$dialog', 'Account', 'localization', 'requestContext', function ($scope, $window, $q, $dialog, Account, localization, requestContext) {

            requestContext.setUpRenderContext('account.ssh', $scope);
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

            /* ssh key creating popup with custom template */
            var newKeyPopup = function(question, callback) {
              var title = 'Add new ssh key';
              var btns = [{result:'cancel', label:'Cancel'}, {result:'add', label:'Add', cssClass: 'btn-primary'}];
              var templateUrl = 'account/static/template/dialog/message.html';

              $dialog.messageBox(title, question, btns, templateUrl)
                .open()
                .then(function(result) {
                  console.log(result.data);
                  if(result.value === 'add') {
                    callback(result.data);
                  }
                })
            }

            $scope.sshKeys = Account.getKeys();

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
              newKeyPopup('', function(keyData) {
                $scope.newKey.name = keyData.keyName;
                $scope.newKey.data = keyData.keyData;

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
              })
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
                return (supportedPlatforms.indexOf($scope.userPlatform) >= 0);
            };

        }]);
}(window.JP.getModule('Account')));