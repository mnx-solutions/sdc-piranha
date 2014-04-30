'use strict';

(function (app) {

    app.controller('Machine.SshController', [
        '$rootScope',
        '$scope',
        '$q',
        '$location',
        '$http',
        'Account',
        'PopupDialog',
        'localization',
        'requestContext',
        function ($rootScope, $scope, $q, $location, $http, Account, PopupDialog, localization, requestContext) {
            requestContext.setUpRenderContext('machine.ssh', $scope);
            localization.bind('machine', $scope);
            $scope.keys = [];
            $scope.noKeysMessage = 'In order to provision your instance, you will need an SSH key';
            $scope.key = {};
            $scope.isCreateInstanceStep = false;

            $scope.createInstance = function () {
                var provisionBundle = $rootScope.commonConfig('provisionBundle');
                if (provisionBundle) {
                    provisionBundle.allowCreate = true;
                }
                $location.path('/compute/create/simple');
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

            $scope.updateKeys = function (cb) {
                $scope.loadingKeys = true;

                $q.when(Account.getKeys(true)).then(function (result) {
                    $scope.keys = result;
                    $scope.loadingKeys = false;
                    $scope.isCreateInstanceStep = $scope.keys && $scope.keys.length > 0;
                    if ($scope.isCreateInstanceStep && !$rootScope.commonConfig('provisionBundle')) {
                        $location.path('/compute');
                    }
                    if (typeof (cb) === 'function') {
                        cb();
                    }
                });
            };

            $scope.updateKeys();

        }]);
}(window.JP.getModule('Machine')));