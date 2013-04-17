'use strict';

(function (app) {
    app.controller(
        'Account.PaymentController',
        ['$scope', 'requestContext', '$http', function ($scope, requestContext, $http) {
            requestContext.setUpRenderContext('account.payment', $scope);

            $scope.submitForm = function() {
                var $p = window.jQuery('#paymentForm').submit();

//                $.ajax({
//                           type: "POST",
//                           url: $p.attr('action'),
//                           data: $p.serialize(),
//                           success: function () {
//                               console.log('s');
//                               console.log(arguments);
//                           },
//                           error: function () {
//                               console.log('e');
//                               console.log(arguments);
//                           }
//                       });
//                $http({
//                    url: $p.attr('action'),
//                    method: 'POST',
//                    data: $p.serialize()
//                }).success(function () {
//                    console.log('s');
//                    console.log(arguments);
//                }).error(function () {
//                    console.log('e');
//                    console.log(arguments);
//                });
            };
        }]);
}(window.JP.getModule('Account')));