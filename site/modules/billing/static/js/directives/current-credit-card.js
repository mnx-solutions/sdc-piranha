'use strict';

(function (app) {

    app.directive('currentCreditCard',[
        'BillingService',
        'localization',
        'Account',

        function (BillingService, localization, Account) {

            return {
                restrict: 'A',
                replace: true,
                scope: true,

                controller: function($scope, $element, $attrs, $transclude) {
                    localization.bind('billing', $scope);
                },

                link: function ($scope) {
                    Account.getAccount().then(function (account) {
                        $scope.provisionEnabled = account.provisionEnabled;
                    });
                    $scope.creditCard = $scope.creditCard || BillingService.getDefaultCreditCard();
                    $scope.$on('creditCardUpdate', function (event, cc) {
                        $scope.creditCard = cc;
                    });
                },
                templateUrl: 'billing/static/partials/current-credit-card.html'
            };
        }]);
}(window.JP.getModule('Billing')));