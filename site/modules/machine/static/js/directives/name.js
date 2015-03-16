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
                        var isLengthOk = viewValue.length <= 189;

                        //TODO: refactor
                        if (!isNameContainDotDash) {
                            isValid = true;
                            isValidNameFirstLastChar = true;
                            isLengthOk = true;
                        } else if (!isValidNameFirstLastChar) {
                            isValid = true;
                            isNameContainDotDash = true;
                            isLengthOk = true;
                        } else if (!isLengthOk) {
                            isValid = true;
                            isValidNameFirstLastChar = true;
                            isNameContainDotDash = true;
                        }

                        ctrl.$setValidity(type + 'Name', isValid);
                        ctrl.$setValidity('nameFirstLastChar', isValidNameFirstLastChar);
                        ctrl.$setValidity('nameContainDotDash', isNameContainDotDash);
                        ctrl.$setValidity('exceedsMaxLength', isLengthOk);

                        return viewValue;
                    });
                }
            };
        }]);
}(window.JP.getModule('Machine')));
