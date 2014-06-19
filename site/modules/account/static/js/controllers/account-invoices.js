'use strict';

(function (app) {
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
            'Account',
            'BillingService',
            '$q',
            function ($scope, requestContext, Account, BillingService, $q) {
            requestContext.setUpRenderContext('account.invoices', $scope);

            $scope.loading = true;
            $scope.isInvocesEnabled = true;
            $scope.invoices = [];
            $scope.subscriptions = [];

            Account.getAccount().then(function(account) {
                if (account.provisionEnabled) {
                    $q.all([
                        $q.when(BillingService.getInvoices()),
                        $q.when(BillingService.getSubscriptions())
                    ]).then(function (results) {
                        $scope.invoices = results[0] || [];
                        $scope.subscriptions = results[1] || [];
                        $scope.loading = false;
                    }, function (err) {
                        $scope.loading = false;
                        $scope.error = err;
                        if (err === "Not Implemented") {
                            $scope.isInvocesEnabled = false;
                        }
                    });
                }
            });

            $scope.gridOrder = ['-invoiceDate'];
            $scope.exportFields = {
                ignore: ['invoiceItems', 'IntegrationId__NS', 'IntegrationStatus__NS', 'SyncDate__NS', 'accountId', 'accountNumber', 'createdBy']
            };

            $scope.gridProps = [
                {
                    id: 'id',
                    name: 'ID',
                    active: false,
                    sequence: 1
                },
                {
                    id: 'invoiceDate',
                    name: 'Date',
                    active: true,
                    sequence: 2
                },
                {
                    id: 'invoiceNumber',
                    name: 'Invoice Number',
                    active: true,
                    sequence: 3
                },
                {
                    id: 'amount',
                    name: 'Total (USD)',
                    active: true,
                    sequence: 4
                },
                {
                    id: 'label',
                    name: 'Download',
                    type: 'button',
                    sequence: 5,
                    active: true,
                    btn: {
                        label: 'PDF',
                        action: function (invoice) {
                            location.href = 'billing/invoice/' + invoice.accountId + '/' + invoice.id;
                        },
                        getClass: function () {
                            return 'cell-link';
                        }
                    }
                },
                {
                    id: 'accountName',
                    name: 'Account Name',
                    active: false,
                    sequence: 6
                },
                {
                    id: 'balance',
                    name: 'Balance',
                    active: false,
                    sequence: 7
                },
                {
                    id: 'dueDate',
                    name: 'Due Date',
                    active: false,
                    sequence: 8
                },
                {
                    id: 'invoiceTargetDate',
                    name: 'Invoice Target Date',
                    active: false,
                    sequence: 9
                },
                {
                    id: 'status',
                    name: 'Status',
                    active: false,
                    sequence: 10
                }
            ];
            $scope.gridActionButtons = [];
            $scope.columnsButton = false;
            $scope.exportIframe = '';
        }]);
}(window.JP.getModule('Account')));