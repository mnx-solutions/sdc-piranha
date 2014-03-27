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
            $scope.invoices = [];
            $scope.subscriptions = BillingService.getSubscriptions();

            $scope.subscriptions.then(function () {}, function (err) {
                $scope.error = err;
            });

            $q.all([
                $q.when(BillingService.getInvoices()),
                $q.when($scope.subscriptions)
            ]).then(function (results) {
                $scope.invoices = results[0];
                $scope.loading = false;
            }, function (err) {
                $scope.error = err;
                if(err === "Not Implemented") {
                    $scope.isInvocesEnabled = false;
                }
            });

            $scope.gridOrder = ['-invoiceDate'];
            $scope.exportFields = {
                ignore: ["IntegrationId__NS", "IntegrationStatus__NS", "SyncDate__NS", "accountId", "accountNumber","accountName", "balance", "createdBy", "dueDate", "id", "invoiceTargetDate", "status", "invoiceItems"]
            };

            $scope.gridProps = [
                {
                    id: 'invoiceDate',
                    name: 'Date',
                    active: true,
                    sequence: 1
                },
                {
                    id: 'invoiceNumber',
                    name: 'Invoice Number',
                    active: true,
                    sequence: 2
                },
                {
                    id: 'amount',
                    name: 'Total (USD)',
                    active: true,
                    sequence: 3
                },
                {
                    id: 'label',
                    name: 'Download',
                    type: 'button',
                    sequence: 4,
                    active: true,
                    btn: {
                        label: 'PDF',
                        action: function (invoice) {
                            $scope.exportIframe = '<iframe src="billing/invoice/' + invoice.accountId + '/' + invoice.id + '"></iframe>'
                        },
                        getClass: function () {
                            return 'cell-link';
                        }
                    }
                }

            ];
            $scope.gridActionButtons = [];
            $scope.exportIframe = '';
        }]);
}(window.JP.getModule('Account')));