'use strict';

(function (app) {
    app.directive('expirationDate',
        function (Account) {
            return {
                require: 'ngModel',
                link: function (scope, elm, attrs, ctrl) {
                    ctrl.$parsers.unshift(function (viewValue) {
                        var yearCtrl = scope.paymentForm.expirationYear;
                        var monthCtrl = scope.paymentForm.expirationMonth;

                        var valid = false;
                        var currentYear = (new Date()).getFullYear();
                        var inputYear = parseInt(yearCtrl.$viewValue);

                        var currentMonth = (new Date()).getMonth();
                        var inputMonth = parseInt(monthCtrl.$viewValue);
                        inputMonth = inputMonth ? inputMonth - 1 : inputMonth;

                        // Validate year
                        if (inputYear) {
                            if (inputYear < currentYear) {
                                valid = false;
                                yearCtrl.$setValidity('invalidExpirationDate', valid);
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

                                    yearCtrl.$setValidity('invalidExpirationDate', valid);
                                }

                                break;

                            case 'expirationYear':
                                if (inputYear) {
                                    if (inputYear === currentYear) {
                                        // Selected month can't be earlier than current month
                                        if (inputMonth < currentMonth) {
                                            valid = false;
                                            monthCtrl.$setValidity('invalidExpirationDate', valid);
                                        } else {
                                            valid = true;
                                            yearCtrl.$setValidity('invalidExpirationDate', valid);
                                        }
                                    } else {
                                        valid = true;
                                        monthCtrl.$setValidity('invalidExpirationDate', valid);
                                    }
                                }
                                break;
                        }

                        ctrl.$setValidity('invalidExpirationDate', valid);

                        return viewValue;
                    });
                }
            };
        });
}(window.JP.getModule('Billing')));