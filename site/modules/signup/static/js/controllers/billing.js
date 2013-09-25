'use strict';

(function (app) {
    app.controller(
        //FIXME: By naming convention it should be Signup.BillingController
        'BillingController',
        ['$scope', 'localization', 'requestContext', 'notification', 'MinFraud',
            function ($scope, localization, requestContext, notification, MinFraud) {
                requestContext.setUpRenderContext('signup.billing', $scope);
                localization.bind('signup', $scope);

                var creditCard = null;

                $scope.$on('creditCardUpdate', function (event, credit) {
                    creditCard = credit;
                });

                //TODO: Should the query really be built on client side ? Makes spoofing real easy
                $scope.$on('billingAccountUpdate', function (event, account) {
                    var query = {
                        domain: account.email.substring(account.email.indexOf('@') + 1),
                        country: account.billingCountry,
                        postal: account.postalCode,
                        custPhone: account.phoneCountry.areaCode + account.phone,
                        bin: creditCard.cardNumberFull.substring(0, 6),
                        city: creditCard.cardHolderInfo.city,
                        region: creditCard.cardHolderInfo.state
                    };
                    MinFraud.getRating(query, function (err, result) {
                        notification.dismiss(null);
                        if (err) {
                            // Go to phone verification if minFraud is unavailable
                            $scope.nextStep();
                            return;
                        }
                        $scope.updateStep();
                    });
                });
            }]);
}(window.JP.getModule('Signup')));