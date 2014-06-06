'use strict';

(function (app) {
    app.directive('roleName', [
        function () {
            return {
                require: 'ngModel',
                link: function (scope, elm, attrs, ctrl) {
                    ctrl.$parsers.unshift(function (viewValue) {
                        //FIXME: Seems like this validation can be done with standard ng-required and ng-pattern
                        if (viewValue.length > 0 && !/^([a-z0-9\.\-]*)$/i.test(viewValue)) {
                            ctrl.$setValidity('roleName', false);
                            return viewValue;
                        }

                        ctrl.$setValidity('roleName', true);
                        return viewValue;
                    });
                }
            };
        }]);
}(window.JP.getModule('rbac')));