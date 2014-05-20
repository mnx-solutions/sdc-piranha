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
                        var LOGIN_RE = /^[a-zA-Z][a-zA-Z0-9_\.@]+$/;
                        var splittedPath = viewValue.split('/');
                        var isValidPath = viewValue[0] === '/' && LOGIN_RE.test(splittedPath[1]);
                        ctrl.$setValidity('filePath', isValidPath);
                        return viewValue;
                    });
                }
            };
        }]);
}(window.JP.getModule('Storage')));