'use strict';

(function (app) {
    app.directive('expirationDate',
        function () {
            return {
                require: 'ngModel',
                restrict: 'E',
                link: function (scope, elm, attrs, ctrl) {
                    scope.$watch(attrs.ngModel, function (val) {
                        // TODO: the logic below is really cryptic, needs improvement
                        if (!val) {
                            return;
                        }
                        var yearCtrl = scope.paymentForm.expirationYear;
                        var monthCtrl = scope.paymentForm.expirationMonth;
                        var valid = true;
                        var currentYear = (new Date()).getFullYear();
                        var inputYear = parseInt(yearCtrl.$viewValue);

                        var currentMonth = (new Date()).getMonth();
                        var inputMonth = parseInt(monthCtrl.$viewValue);
                        inputMonth = inputMonth ? inputMonth - 1 : inputMonth;

                        switch (attrs.id) {
                            case 'expirationMonth':
                                // Ignore validation if year is not set
                                if (!inputYear) {
                                    valid = true;
                                    yearCtrl.$dirty = !valid;
                                } else if (inputYear === currentYear) {
                                    // Selected month can't be earlier than current month
                                    valid = inputMonth >= currentMonth;

                                    yearCtrl.$setValidity('invalidExpirationDate', valid);
                                    yearCtrl.$dirty = !valid;
                                }
                            break;

                            case 'expirationYear':
                                if (inputYear) {
                                    if (inputYear === currentYear) {
                                        // Selected month can't be earlier than current month
                                        if (inputMonth < currentMonth) {
                                            valid = false;
                                            monthCtrl.$setValidity('invalidExpirationDate', valid);
                                            monthCtrl.$dirty = !valid;
                                        } else {
                                            valid = true;
                                            yearCtrl.$setValidity('invalidExpirationDate', valid);
                                            yearCtrl.$dirty = !valid;
                                        }
                                    } else {
                                        valid = true;
                                        monthCtrl.$setValidity('invalidExpirationDate', valid);
                                        monthCtrl.$dirty = !valid;
                                    }
                                }
                            break;
                        }

                        ctrl.$setValidity('invalidExpirationDate', valid);
                    });
                }
            };
        });
}(window.JP.getModule('Billing')));