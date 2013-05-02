'use strict';

(function (app) {

    app.directive('currentCreditCard',['BillingService', '$q', function (BillingService, $q) {

        return {
            restrict: 'A',
            replace: true,
            scope: true,
            link: function ($scope) {

                $scope.creditCard = $scope.creditCard || BillingService.getDefaultCreditCard();
                $q.when($scope.creditCard, function (cc) {
                    $scope.creditCardJSON = JSON.stringify(cc, null, 2);
                });

                $scope.$on('creditCardUpdate', function (cc) {
                    $scope.creditCard = cc;
                    $scope.creditCardJSON = JSON.stringify(cc, null, 2);
                });
            },
            templateUrl: 'billing/static/partials/current-credit-card.html'
        };
    }]);
}(window.JP.getModule('Billing')));