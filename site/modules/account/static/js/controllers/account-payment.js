'use strict';

(function (app) {
    app.controller(
        'Account.PaymentController',
        ['$scope', 'requestContext', '$http', 'BillingService', function ($scope, requestContext, $http, BillingService) {
            requestContext.setUpRenderContext('account.payment', $scope);

            $scope.paymentMethods = BillingService.getPaymentMethods();
        }]);
}(window.JP.getModule('Account')));