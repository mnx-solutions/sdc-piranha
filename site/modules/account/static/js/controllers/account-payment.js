'use strict';

(function (app) {
    app.controller(
        'Account.PaymentController',
        ['$scope', 'requestContext', '$http', 'BillingService', function ($scope, requestContext, $http, BillingService) {
            requestContext.setUpRenderContext('account.payment', $scope);

            function getCardType(number)
            {
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
            
            $scope.cards = {
                AmericanExpress: 'AmericanExpress',
                Discover: 'Discover',
                MasterCard: 'MasterCard',
                Visa: 'Visa'
            };

            $scope.form = {
                cardHolderInfo: {}
            };

            $scope.$watch('form.creditCardNumber', function (newVal, oldVal) {
                console.log('here');
                console.log(newVal);
                var type = getCardType(newVal);
                console.log(type);
                if(type) {
                    $scope.form.creditCardType = $scope.cards[type];
                }
            }, true);

            $scope.submitForm = function() {
                BillingService.addPaymentMethod($scope.form, function (err, job) {
                    console.log(arguments);
                });
            };

            $scope.payments = BillingService.getPaymentMethods();
        }]);
}(window.JP.getModule('Account')));