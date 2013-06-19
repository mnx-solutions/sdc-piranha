'use strict';

(function (app) {
    app.controller(
        'StorageController',
        ['$scope', 'Account', 'requestContext', '$q', 'localization', '$dialog', function ($scope, Account, requestContext, $q, localization, $dialog) {
            localization.bind('storage', $scope);
            requestContext.setUpRenderContext('storage.index', $scope);

            $scope.account = Account.getAccount();
            $scope.sshKeys = Account.getKeys(true);

            $scope.loading = true;
            $scope.sshKeys.then(function (keys) {
                if (keys.length > 0) {
                    $scope.keyId = keys[0].fingerprint;
                }
            });

            $scope.openVideo = function () {
                var d = $dialog.dialog({
                    backdrop: true,
                    keyboard: true,
                    dialogClass: "video",
                    backdropClick: true,
                    template: '<div flow-player=""><video autoplay><source type="video/mp4" src="storage/static/data/setup.mp4"></video></div>',
                    controller: "DialogController"
                });
                d.open();
            }

        }]);
}(window.JP.getModule('Storage')));


(function (app) {
    app.controller(
        'DialogController',['$scope', 'dialog',
        function($scope, dialog) {
            $scope.close = function () {
                dialog.close();
            };
        }]
    );
}(window.JP.getModule('Storage')));
