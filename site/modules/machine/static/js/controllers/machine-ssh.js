'use strict';

(function (app) {

    app.controller('Machine.SshController', [
        '$rootScope',
        '$scope',
        '$q',
        '$location',
        'localization',
        'requestContext',
        function ($rootScope, $scope, $q, $location, localization, requestContext) {
            requestContext.setUpRenderContext('machine.ssh', $scope);
            localization.bind('machine', $scope);
            $scope.keys = [];
            $scope.key = {};

            $scope.createInstance = function () {
                var provisionBundle = $rootScope.commonConfig('provisionBundle');
                if (provisionBundle) {
                    provisionBundle.ready = true;
                }
                $location.path('/compute/create/simple');
            };
        }]);
}(window.JP.getModule('Machine')));