'use strict';

(function (app) {
    app.controller(
        'Account.InvoicesController', [
            '$scope',
            'requestContext',
            '$http',
            'BillingService',
            'notification',
            'localization',
            '$q',
            function ($scope, requestContext, $http, BillingService, notification, localization, $q) {
            requestContext.setUpRenderContext('account.invoices', $scope);

            $scope.loading = false;
            $scope.invoices = BillingService.getInvoices(null, function (err, job) {
                if(err) {
                    $scope.error = err;
                    notification.push('invoices', { type: 'error' },
                        localization.translate(null,
                            'billing',
                            'Unable to retrieve invoices'
                        )
                    );
                }
            });
            $scope.subscriptions = BillingService.getSubscriptions(null, function (err, job) {
                $scope.loading = false;
                if(err) {
                    $scope.error = err;
                    notification.push('subscriptions', { type: 'error' },
                        localization.translate(null,
                            'billing',
                            'Unable to retrieve subscriptions'
                        )
                    );
                }
            });

            $q.all([
                $q.when($scope.invoices),
                $q.when($scope.subscriptions)
            ]).then(function () {
                $scope.loading = false;
            });

            $scope.exportIframe = '';
            $scope.download = function (invoice) {
                $scope.exportIframe += '<iframe src="billing/invoice/' + invoice.accountId + '/' + invoice.id + '" onload="_download_' + invoice.id + '()"></iframe>';
                invoice.downloading = true;
                window['_download_'+invoice.id] = function () {
                    invoice.downloading = false;
                    delete window['_download_'+invoice.id];
                };
            };

        }]);
}(window.JP.getModule('Account')));