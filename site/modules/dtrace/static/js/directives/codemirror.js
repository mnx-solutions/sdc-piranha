'use strict';

(function (ng, app) {
    app.directive('codeMirror', ['$timeout', function ($timeout) {
        return {
            scope: {
                source: '='
            },
            link: function (scope, $element) {
                var sourceValue;
                var editor = CodeMirror.fromTextArea($element[0], {
                    lineNumbers : true,
                    lineWrapping: true,
                    theme: 'custom',
                    mode: 'javascript'
                });
                editor.on('change', function (cm) {
                    $timeout(function () {
                        scope.source = sourceValue = cm.getValue();
                    });
                });
                scope.$watch('source', function (source) {
                    if (sourceValue !== source) {
                        editor.setValue(source);
                    }
                });
            }
        };
    }]);
}(window.angular, window.JP.getModule('dtrace')));