'use strict';

(function (app) {
    app.controller(
        'Account.PaymentController', [
            '$scope',
            'requestContext',
            function ($scope, requestContext) {
                requestContext.setUpRenderContext('account.payment', $scope);
            }]);
}(window.JP.getModule('Account')));