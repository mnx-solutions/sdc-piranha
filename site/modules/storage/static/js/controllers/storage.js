'use strict';

(function (app) {
    app.controller(
        'StorageController',
        ['$scope', 'Account', 'requestContext', 'localization', '$dialog', 'rbac.Service', 'PopupDialog', function ($scope, Account, requestContext, localization, $dialog, RBAC, PopupDialog) {
            localization.bind('storage', $scope);
            requestContext.setUpRenderContext('storage.index', $scope);
            $scope.loading = true;

            var errorCallback = function (err) {
                $scope.loading = false;
                PopupDialog.errorObj(err);
            };
            var createSshList = function (keys) {
                $scope.sshKeys = keys;
                if (keys.length > 0) {
                    $scope.keyId = keys[0].fingerprint;
                    $scope.keyName = keys[0].name;
                }
                $scope.loading = false;
            };

            Account.getAccount().then(function (account) {
                $scope.account = account;
                if (account.isSubuser) {
                    RBAC.listUserKeys(account.id).then(function (keys) {
                        createSshList(keys);
                        Account.getParentAccount().then(function (parentAccount) {
                            $scope.parentAccount = parentAccount.login;
                        });
                    }, errorCallback);
                } else {
                    Account.getKeys(true).then(function (keys) {
                        createSshList(keys);
                    });
                }
            });

            $scope.openVideo = function () {
                var d = $dialog.dialog({
                    backdrop: true,
                    keyboard: true,
                    dialogClass: 'video',
                    backdropClick: true,
                    template: '<iframe src="https://player.vimeo.com/video/68515490" width="640" height="320" frameborder="0" webkitAllowFullScreen mozallowfullscreen allowFullScreen></iframe>',
                    controller: 'StorageDialogController'
                });
                d.open();
            };

        }]);
}(window.JP.getModule('Storage')));
