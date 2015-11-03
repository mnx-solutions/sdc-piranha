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
            'PopupDialog',
            '$location',
            '$q',
            function ($scope, requestContext, Account, BillingService, PopupDialog, $location, $q) {
            requestContext.setUpRenderContext('account.invoices', $scope);

            $scope.loading = true;
            $scope.isInvocesEnabled = $scope.features.invoices === 'enabled';
            $scope.invoices = [];

            var scrollToInvoices = function () {
                if ($location.path() === '/account/invoices') {
                    // setTimeout allows to wait when all DOM elements will be available and then we can make correct scrolling.
                    setTimeout(function () {
                        document.getElementById('invoices').scrollIntoView();
                        if ($scope.loading) {
                            scrollToInvoices();
                        }
                    }, 1000);
                }
            };

            if ($scope.isInvocesEnabled) {
                Account.getAccount().then(function(account) {
                    if (account.provisionEnabled && !account.isSubuser) {
                        scrollToInvoices();
                        $q.all([
                            $q.when(BillingService.getInvoices())
                        ]).then(function (results) {
                            var invoices = results[0];

                            if (invoices.length) {
                                $scope.invoices = invoices.filter(function (invoice) {
                                    return invoice.status === 'Posted';
                                });
                            }
                        }, function (err) {
                            $scope.error = err;
                            if (err === "Not Implemented") {
                                $scope.isInvocesEnabled = false;
                            }
                        }).finally(function () {
                            $scope.loading = false;
                        });
                    } else {
                        $scope.loading = false;
                    }
                }).catch(function (error) {
                    $scope.loading = false;
                    PopupDialog.errorObj(error);
                });
            }

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
                    id: 'balance',
                    name: 'Balance Due (USD)',
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