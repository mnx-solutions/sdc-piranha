'use strict';

(function (app) {

    app.directive('changeCreditCard',['$http', function ($http) {

        return {
            restrict: 'A',
            replace: true,
            scope: true,
            link: function (scope) {
                console.log('here');
                scope.form = {};
                scope.cards = {
                    AmericanExpress: 'AmericanExpress',
                    Discover: 'Discover',
                    MasterCard: 'MasterCard',
                    Visa: 'Visa'
                };

                $http.get('account/form').success(function(data){
                    scope.form = data;
                });
            },
            template: '<form id="paymentForm" class="form-horizontal" action="{{form.action}}" name="HostedPaymentMethodPageForm" method="post">' +
                '<input type="hidden" name="method" value="submitPage"/>' +
                '<input type="hidden" name="{{key}}" value="{{value}}" data-ng-repeat="(key, value) in form.fields"/>' +
                '<div class="control-group">' +
                    '<label class="control-label" for="field_creditCardType">Card Type</label>' +
                    '<div class="controls">' +
                        '<select name="field_creditCardType">' +
                            '<option value="{{k}}" data-ng-repeat="(k, v) in cards">{{v}}</option>' +
                        '</select>' +
                    '</div>' +
                '</div>' +
                '<div class="control-group">' +
                    '<label class="control-label" for="field_creditCardNumber">Card Number</label>' +
                    '<div class="controls">' +
                        '<input type="text" id="field_creditCardNumber" placeholder="Card Number" name="field_creditCardNumber" maxlength="16" size="40">' +
                    '</div>' +
                '</div>' +
                '<div class="control-group">' +
                    '<label class="control-label" for="field_creditCardExpirationMonth">Month</label>' +
                    '<div class="controls">' +
                        '<input type="text" id="field_creditCardExpirationMonth" placeholder="00" name="field_creditCardExpirationMonth">' +
                    '</div>' +
                '</div>' +
                '<div class="control-group">' +
                    '<label class="control-label" for="field_creditCardExpirationYear">Year</label>' +
                    '<div class="controls">' +
                        '<input type="text" id="field_creditCardExpirationYear" placeholder="0000" name="field_creditCardExpirationYear">' +
                    '</div>' +
                '</div>' +
                '<div class="control-group">' +
                    '<label class="control-label" for="field_cardSecurityCode">CVV</label>' +
                    '<div class="controls">' +
                        '<input type="text" id="field_cardSecurityCode" name="field_cardSecurityCode">' +
                    '</div>' +
                '</div>' +
                '<div class="control-group">' +
                    '<label class="control-label" for="field_creditCardHolderName">Holder Name</label>' +
                    '<div class="controls">' +
                    '   <input type="text" id="field_creditCardHolderName" placeholder="Name" name="field_creditCardHolderName" size="40">' +
                    '</div>' +
                '</div>' +
                '</form>'
        };
    }]);
}(window.JP.getModule('Machine')));