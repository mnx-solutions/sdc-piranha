'use strict';

(function (app) {
    app.directive('machineName', function() {
        return {
            require: 'ngModel',
            link: function(scope, elm, attrs, ctrl) {
                ctrl.$parsers.unshift(function(viewValue) {
                    if (viewValue.length > 3 && /^[a-z0-9]+$/i.test(viewValue)) {
                        ctrl.$setValidity('machineName', true);
                        return viewValue;
                    } else {
                        ctrl.$setValidity('machineName', false);
                        return undefined;
                    }
                });
            }
        };
    });
}(window.JP.getModule('Machine')));