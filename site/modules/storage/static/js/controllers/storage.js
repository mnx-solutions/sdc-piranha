'use strict';

(function (app) {
    app.controller(
        'StorageController',
        ['$scope', 'Account', 'requestContext', 'localization', '$dialog', function ($scope, Account, requestContext, localization, $dialog) {
            localization.bind('storage', $scope);
            requestContext.setUpRenderContext('storage.index', $scope);

            $scope.account = Account.getAccount();
            $scope.sshKeys = Account.getKeys(true);

            $scope.loading = true;
            $scope.sshKeys.then(function (keys) {
                if (keys.length > 0) {
                    $scope.keyId = keys[0].fingerprint;
                    $scope.keyName = keys[0].name;
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
