'use strict';

(function (app) {
    app.controller(
        'Account.PaymentController',
        ['$scope', 'requestContext', '$http', function ($scope, requestContext, $http) {
            requestContext.setUpRenderContext('account.payment', $scope);

            $scope.submitForm = function() {
                var $p = window.jQuery('#paymentForm').submit();
            };
        }]);
}(window.JP.getModule('Account')));