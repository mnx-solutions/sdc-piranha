'use strict';

(function (app) {

    app.directive('currentCreditCard',[
        'BillingService',
        'localization',

        function (BillingService, localization) {

            return {
                restrict: 'A',
                replace: true,
                scope: true,

                controller: function($scope, $element, $attrs, $transclude) {
                    localization.bind('billing', $scope);
                },

                link: function ($scope) {

                    $scope.creditCard = $scope.creditCard || BillingService.getDefaultCreditCard();

                    $scope.$on('creditCardUpdate', function (event, cc) {
                        $scope.creditCard = cc;
                    });
                },
                templateUrl: 'billing/static/partials/current-credit-card.html'
            };
        }]);
}(window.JP.getModule('Billing')));