'use strict';

(function (app) {
    app.directive('roleNameVerify', [
        function () {
            return {
                require: 'ngModel',
                link: function (scope, element, attrs, ctrl) {
                    var pattern = attrs.pattern ? new RegExp(attrs.pattern) : undefined;

                    ctrl.$parsers.unshift(function (viewValue) {
                        var validity = {
                            required: !!viewValue,
                            pattern: !pattern || pattern.test(viewValue),
                            reserved: !viewValue || viewValue.toLowerCase() !== 'administrator'
                        };
                        ctrl.$setValidity('required', validity.required);
                        ctrl.$setValidity('pattern', validity.pattern);
                        ctrl.$setValidity('reserved', validity.reserved);
                        return validity.required && validity.pattern && validity.reserved ? viewValue : undefined;
                    });
                }
            };
        }]);
}(window.JP.getModule('rbac')));