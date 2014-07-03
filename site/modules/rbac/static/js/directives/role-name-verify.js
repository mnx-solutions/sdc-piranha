'use strict';

(function (app) {
    app.directive('roleNameVerify', [
        function () {
            return {
                require: 'ngModel',
                link: function (scope, element, attrs, ctrl) {
                    var pattern = attrs.pattern ? new RegExp(attrs.pattern) : undefined;

                    ctrl.$parsers.unshift(function (viewValue) {
                        var value;
                        if (!viewValue) {
                            ctrl.$setValidity('required', false);
                        } else if (pattern && !pattern.test(viewValue)) {
                            ctrl.$setValidity('pattern', false);
                        } else if (viewValue.toLowerCase() === 'administrator') {
                            ctrl.$setValidity('reserved', false);
                        } else {
                            ctrl.$setValidity('required', true);
                            ctrl.$setValidity('pattern', true);
                            ctrl.$setValidity('reserved', true);
                            value = viewValue;
                        }
                        return value;
                    });
                }
            };
        }]);
}(window.JP.getModule('rbac')));