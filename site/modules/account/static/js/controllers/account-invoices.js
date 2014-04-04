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
                ignore: ['invoiceItems']
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
                    id: 'IntegrationId__NS',
                    name: 'Integration ID',
                    active: false,
                    sequence: 6
                },
                {
                    id: 'IntegrationStatus__NS',
                    name: 'Integration Status',
                    active: false,
                    sequence: 7
                },
                {
                    id: 'SyncDate__NS',
                    name: 'Sync Date',
                    active: false,
                    sequence: 8
                },
                {
                    id: 'accountId',
                    name: 'Account ID',
                    active: false,
                    sequence: 9
                },
                {
                    id: 'accountNumber',
                    name: 'Account Number',
                    active: false,
                    sequence: 10
                },
                {
                    id: 'accountName',
                    name: 'Account Name',
                    active: false,
                    sequence: 11
                },
                {
                    id: 'balance',
                    name: 'Balance',
                    active: false,
                    sequence: 12
                },
                {
                    id: 'createdBy',
                    name: 'Created By',
                    active: false,
                    sequence: 13
                },
                {
                    id: 'dueDate',
                    name: 'Due Date',
                    active: false,
                    sequence: 14
                },
                {
                    id: 'invoiceTargetDate',
                    name: 'Invoice Target Date',
                    active: false,
                    sequence: 15
                },
                {
                    id: 'status',
                    name: 'Status',
                    active: false,
                    sequence: 16
                }
            ];
            $scope.gridActionButtons = [];
            $scope.columnsButton = false;
            $scope.exportIframe = '';
        }]);
}(window.JP.getModule('Account')));