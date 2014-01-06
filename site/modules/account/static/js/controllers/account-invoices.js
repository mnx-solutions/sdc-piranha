'use strict';

(function (app) {
    // filters out invoices with != "Posted" state
    app.filter('hideNotPosted', function() {
        return function(invoices) {
            if(invoices) {
                for (var i = invoices.length - 1; i > 0; i--) {
                    if(invoices[i].status !== 'Posted') {
                        invoices.splice(i, 1);
                    }
                }
            }
            return invoices;
        };
    });

    app.controller(
        'Account.InvoicesController', [
            '$scope',
            'requestContext',
            '$http',
            'BillingService',
            '$q',
            function ($scope, requestContext, $http, BillingService, $q) {
            requestContext.setUpRenderContext('account.invoices', $scope);

            $scope.loading = true;
            $scope.isInvocesEnabled = true;
            $scope.invoices = BillingService.getInvoices();
            $scope.subscriptions = BillingService.getSubscriptions();

            $scope.invoices.then(function () {}, function (err) {
                $scope.error = err;
                if(err === "Not Implemented") {
                    $scope.isInvocesEnabled = false;
                }
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
                $scope.exportIframe = '<iframe src="billing/invoice/' + invoice.accountId + '/' + invoice.id + '"></iframe>';
            };

        }]);
}(window.JP.getModule('Account')));