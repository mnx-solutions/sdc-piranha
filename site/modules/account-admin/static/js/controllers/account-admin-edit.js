'use strict';

(function (ng, app) {
    app.controller(
        'AccountAdmin.EditController',
        [
            '$scope',
            '$location',
            'requestContext',
            'AccountAdmin',
            'localization',
            function ($scope, $location, requestContext, Account, localization) {
                localization.bind('account-admin', $scope);
                requestContext.setUpRenderContext('account-admin.edit', $scope);

                var id = requestContext.getParam('id');

                $scope.steps = ['start','tropo','billing','ssh'];
                $scope.step = Account.getSignupStep(id);
                $scope.currentStep = $scope.step;

                $scope.setStep = function() {
                    Account.setSignupStep(id, $scope.step, function (res) {
                        console.log(arguments);
                        $scope.currentStep = $scope.step;
                    });
                };
            }

        ]);
}(window.angular, window.JP.getModule('AccountAdmin')));
