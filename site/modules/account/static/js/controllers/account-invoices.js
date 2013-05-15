'use strict';

(function (app) {
    app.controller(
        'Account.InvoicesController',
        ['$scope', 'requestContext', '$http', 'BillingService', function ($scope, requestContext, $http, BillingService) {
            requestContext.setUpRenderContext('account.invoices', $scope);

            $scope.loading = false;
            $scope.invoices = BillingService.getInvoices();

            $scope.invoices.then(function () {
                $scope.loading = false;
            });


            $scope.openDetails = null;
            $scope.setOpenDetails = function(id) {
                if(id === $scope.openDetails) {
                    $scope.openDetails = null;
                } else {
                    $scope.openDetails = id;
                }
            };

        }]);
}(window.JP.getModule('Account')));