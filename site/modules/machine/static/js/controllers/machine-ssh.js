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

            $scope.$on('ssh-form:onKeyUpdated', function (event, keys) {
                $scope.isCreateInstanceStep = keys && keys.length > 0;
                if ($scope.isCreateInstanceStep && !$rootScope.commonConfig('provisionBundle')) {
                    $location.path('/compute');
                }
            });
        }]);
}(window.JP.getModule('Machine')));