'use strict';

(function (app) {
    app.directive('machineName', [
        function () {
            return {
                require: 'ngModel',
                link: function (scope, elm, attrs, ctrl) {
                    ctrl.$parsers.unshift(function (viewValue) {
                        var type = scope.$eval(attrs.machineName);
                        var isValid = !viewValue.length || /^([a-z0-9\.\-]*)$/i.test(viewValue);
                        ctrl.$setValidity(type + 'Name', isValid);
                        return viewValue;
                    });
                }
            };
        }]);
}(window.JP.getModule('Machine')));
