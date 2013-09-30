'use strict';

(function (app) {
    app.directive('expirationDate',
        function (Account) {
            return {
                require: 'ngModel',
                link: function (scope, elm, attrs, ctrl) {
                    ctrl.$parsers.unshift(function (viewValue) {
                        var valid = false;
                        var currentYear = (new Date()).getFullYear();
                        var inputYear = parseInt(scope.paymentForm.expirationYear.$viewValue);

                        var currentMonth = (new Date()).getMonth();
                        var inputMonth = parseInt(scope.paymentForm.expirationMonth.$viewValue);
                        inputMonth = inputMonth ? inputMonth - 1 : inputMonth;

                        // Validate year
                        if (inputYear) {
                            if (inputYear < currentYear) {
                                valid = false;
                            } else {
                                valid = true;
                            }
                        }

                        switch (attrs.id) {
                            case 'expirationMonth':
                                // Ignore validation if year is not set
                                if (!inputYear) {
                                    valid = true;
                                } else if (inputYear && inputYear === currentYear) {
                                    // Selected month can't be earlier than current month
                                    if (inputMonth < currentMonth) {
                                        valid = false;
                                    } else {
                                        valid = true;
                                    }
                                }

                                break;

                            case 'expirationYear':
                                break;
                        }

                        ctrl.$setValidity('invalidExpirationDate', valid);

                        return viewValue;
                    });
                }
            };
        });
}(window.JP.getModule('Billing')));