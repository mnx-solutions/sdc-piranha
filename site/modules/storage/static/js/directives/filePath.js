'use strict';

(function (app) {
    app.directive('filePath', [
        function () {
            return {
                require: 'ngModel',
                link: function (scope, elm, attrs, ctrl) {
                    ctrl.$parsers.unshift(function (viewValue) {
                        ctrl.$setValidity('filePath', viewValue[0] === '/' && viewValue.length > 1);
                        return viewValue;
                    });
                }
            };
        }]);
}(window.JP.getModule('Storage')));