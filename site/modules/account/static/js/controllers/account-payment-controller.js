'use strict';

(function (app) {
    app.controller(
        'Account.PaymentController',
        ['$scope', 'requestContext', function ($scope, requestContext) {
            requestContext.setUpRenderContext('account.payment', $scope);

            $scope.submitForm = function() {
                window.submitHostedPage('z_hppm_iframe');
            };
        }]);
}(window.JP.getModule('Account')));