'use strict';

(function (ng, app) {
    app.directive('codeMirror', ['$timeout', function ($timeout) {
        return {
            scope: {
                ngModel: '='
            },
            require: 'ngModel',
            link: function (scope, element, attrs, ctrl) {
                var sourceValue;
                var regex = attrs.regexValidate ? new RegExp(attrs.regexValidate, 'i') : null;
                var editor = CodeMirror.fromTextArea(element[0], {
                    lineNumbers : true,
                    lineWrapping: true,
                    theme: 'custom',
                    mode: 'javascript'
                });

                editor.on('change', function (cm) {
                    $timeout(function () {
                        scope.ngModel = sourceValue = cm.getValue();
                        if (regex && sourceValue) {
                            ctrl.$setValidity('pattern', regex.test(sourceValue));
                        }
                    });
                });
                scope.$watch('ngModel', function (source) {
                    if (sourceValue !== source) {
                        editor.setValue(source);
                    }
                });
            }
        };
    }]);
}(window.angular, window.JP.getModule('dtrace')));