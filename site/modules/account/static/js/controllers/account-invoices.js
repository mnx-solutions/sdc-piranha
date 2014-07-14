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
            $scope.payments = [];

            Account.getAccount().then(function(account) {
                if (account.provisionEnabled) {
                    $q.all([
                        $q.when(BillingService.getInvoices()),
                        $q.when(BillingService.getPayments())
                    ]).then(function (results) {
                        var invoices = results[0];
                        var payments = results[1];
                        var paidInvoices = [];
                        if (payments.length) {
                            paidInvoices = [].concat.apply([], payments.filter(function (payment) {
                                return payment.status === 'Processed';
                            }).map(function (payment) {
                                return payment.paidInvoices.map(function(inv) {
                                    return inv.invoiceNumber;
                                });
                            }));
                        }
                        if (invoices.length) {
                            $scope.invoices = invoices.filter(function (invoice) {
                                return invoice.status === 'Posted';
                            }).map(function (invoice) {
                                invoice.paymentStatus = (paidInvoices.length && paidInvoices.indexOf(invoice.invoiceNumber) !== -1) ? 'Paid' : 'Unpaid';
                                return invoice;
                            });
                        }

                        $scope.loading = false;
                    }, function (err) {
                        $scope.loading = false;
                        $scope.error = err;
                        if (err === "Not Implemented") {
                            $scope.isInvocesEnabled = false;
                        }
                    });
                } else {
                    $scope.loading = false;
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
                    id: 'paymentStatus',
                    name: 'Status',
                    active: true,
                    sequence: 5
                },
                {
                    id: 'label',
                    name: 'Download',
                    type: 'button',
                    sequence: 6,
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
                    sequence: 7
                },
                {
                    id: 'balance',
                    name: 'Balance',
                    active: false,
                    sequence: 8
                },
                {
                    id: 'dueDate',
                    name: 'Due Date',
                    active: false,
                    sequence: 9
                },
                {
                    id: 'invoiceTargetDate',
                    name: 'Invoice Target Date',
                    active: false,
                    sequence: 10
                },
                {
                    id: 'status',
                    name: 'Status',
                    active: false,
                    sequence: 11
                }
            ];
            $scope.gridActionButtons = [];
            $scope.columnsButton = false;
            $scope.exportIframe = '';
        }]);
}(window.JP.getModule('Account')));