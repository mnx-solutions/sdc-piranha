'use strict';

(function (app) {
    app.directive('machineName', [
        function () {
            return {
                require: 'ngModel',
                link: function (scope, elm, attrs, ctrl) {
                    ctrl.$parsers.unshift(function (viewValue) {
                        var type = scope.$eval(attrs.machineName);
                        var isValid = viewValue.length === 0 || /^([a-z0-9]+(([\.]{1}|[\-]+)[a-z0-9]+)*)$/i.test(viewValue);
                        var isValidNameFirstLastChar = !(/^[\-\.]|[\-\.]$/.test(viewValue));
                        var isNameContainDotDash = !(viewValue.indexOf('.-') !== -1 || viewValue.indexOf('-.') !== -1 || viewValue.indexOf('..') !== -1);
                        if (!isNameContainDotDash) {
                            isValid = true;
                            isValidNameFirstLastChar = true;
                        } else if (!isValidNameFirstLastChar) {
                            isValid = true;
                            isNameContainDotDash = true;
                        }
                        ctrl.$setValidity(type + 'Name', isValid);
                        ctrl.$setValidity('nameFirstLastChar', isValidNameFirstLastChar);
                        ctrl.$setValidity('nameContainDotDash', isNameContainDotDash);
                        return viewValue;
                    });
                }
            };
        }]);
}(window.JP.getModule('Machine')));
