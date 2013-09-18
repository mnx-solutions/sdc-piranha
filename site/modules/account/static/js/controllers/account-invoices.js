'use strict';

(function (app) {
    app.controller(
        'Account.InvoicesController', [
            '$scope',
            'requestContext',
            '$http',
            'BillingService',
            '$q',
            function ($scope, requestContext, $http, BillingService, $q) {
            requestContext.setUpRenderContext('account.invoices', $scope);

            $scope.loading = false;
            $scope.invoices = BillingService.getInvoices();
            $scope.subscriptions = BillingService.getSubscriptions();

            $scope.invoices.then(function () {}, function (err) {
                $scope.error = err;
            });
            $scope.subscriptions.then(function () {}, function (err) {
                $scope.error = err;
            });

            $q.all([
                $q.when($scope.invoices),
                $q.when($scope.subscriptions)
            ]).then(function () {
                $scope.loading = false;
            });

            $scope.exportIframe = '';
            $scope.download = function (invoice) {
                $scope.exportIframe += '<iframe src="billing/invoice/' + invoice.accountId + '/' + invoice.id + '"></iframe>';
            };

        }]);
}(window.JP.getModule('Account')));