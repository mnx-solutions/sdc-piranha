'use strict';

(function (app) {
    app.controller('TFAController', [
        '$scope',
        'localization',
        'requestContext',
        'TFAService',

        function ($scope, localization, requestContext, TFAService) {
            requestContext.setUpRenderContext('tfa.index', $scope);
            localization.bind('tfa', $scope);

            $scope.otpass = '';

            $scope.features = window.JP.get('features') || {};
            $scope.brandingEnabled = $scope.features.useBrandingOrange === 'enabled';

            $scope.login = function () {
                $scope.error = false;
                TFAService.login($scope.otpass).then(function () {
                    //Should never reach this
                    $scope.success = true;
                }, function (err) {
                    if (err) {
                        $scope.error = 'One time password is incorrect.';
                    } else {
                        $scope.error = 'Redirecting to login';
                    }
                });
            };
        }]);
}(window.JP.getModule('TFA')));