'use strict';

(function (app) {
    app.controller(
        'Signup.BillingController',
        ['$scope', 'localization', 'requestContext', 'notification',
            function ($scope, localization, requestContext, notification) {
                requestContext.setUpRenderContext('signup.billing', $scope);
                localization.bind('signup', $scope);

                $scope.$on('creditCardUpdate', function () {
                    notification.dismiss(null);
                    $scope.updateStep();
                });
            }]);
}(window.JP.getModule('Signup')));