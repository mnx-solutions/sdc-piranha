'use strict';

(function (app) {
    app.controller(
        'Account.InvoicesController',
        ['$scope', 'requestContext', '$http', 'BillingService', function ($scope, requestContext, $http, BillingService) {
            requestContext.setUpRenderContext('account.invoices', $scope);

            $scope.loading = false;
            $scope.invoices = BillingService.getInvoices();
            $scope.subscriptions = BillingService.getSubscriptions();

            $scope.invoices.then(function () {
                $scope.loading = false;
            });


            $scope.openDetails = null;
            $scope.setOpenDetails = function(id) {
                if ($scope.openDetails === id) {
                    $scope.openDetails = null;
                } else {
                    $scope.openDetails = id;
                }
            };

            $scope.exportIframe = '';
            $scope.download = function (invoice) {
                console.log('Downloading invoice from ' + 'billing/invoice/' + invoice.accountId + '/' + invoice.id);
                $scope.exportIframe += '<iframe src="billing/invoice/' + invoice.accountId + '/' + invoice.id + '"></iframe>';
            };

        }]);
}(window.JP.getModule('Account')));