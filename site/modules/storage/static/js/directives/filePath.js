'use strict';

(function (app) {
    app.directive('filePath', [
        function () {
            return {
                require: 'ngModel',
                link: function (scope, elm, attrs, ctrl) {
                    scope.$watch('filePath', function (path) {
                        if (path && path.length > 0) {
                            ctrl.$setValidity('filePath', path[0] === '/');
                        }
                    });
                    ctrl.$parsers.unshift(function (viewValue) {
                        ctrl.$setValidity('filePath', viewValue[0] === '/' && viewValue.length > 1 && viewValue[1] !== '/');
                        return viewValue;
                    });
                }
            };
        }]);
}(window.JP.getModule('Storage')));