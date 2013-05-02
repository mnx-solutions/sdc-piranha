'use strict';

(function (app) {

    app.directive('creditCard',['BillingService', '$q', function (BillingService, $q) {

        return {
            restrict: 'A',
            replace: true,
            scope: true,
            link: function ($scope) {

                function getCardType(number){
                    if(!number) {
                        return false;
                    }

                    if (number.match(/^4/) !== null){
                        return 'Visa';
                    }

                    if (number.match(/^(34|37)/) !== null){
                        return 'AmericanExpress';
                    }

                    if (number.match(/^5[1-5]/) !== null){
                        return 'MasterCard';
                    }

                    if (number.match(/^6011/) !== null){
                        return 'Discover';
                    }

                    return false;
                }

                $scope.form = {
                    cardHolderInfo: {}
                };

                $scope.isSaving = false;

                $scope.$watch('form.creditCardNumber', function (newVal) {
                    $scope.form.creditCardType = getCardType(newVal);
                }, true);

                $scope.submitForm = function() {
                    $scope.isSaving = true;
                    BillingService.addPaymentMethod($scope.form, function (err, job) {
                        //TODO: Error handling - how?
                        var cc = BillingService.getDefaultCreditCard();
                        $q.when(cc, function (credit) {
                            $scope.isSaving = false;
                            $scope.$emit('creditCardUpdate', credit);
                        });
                    });
                };
            },
            templateUrl: 'billing/static/partials/credit-card.html'
        };
    }]);
}(window.JP.getModule('Billing')));