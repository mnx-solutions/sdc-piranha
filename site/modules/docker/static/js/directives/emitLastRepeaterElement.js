'use strict';

(function (app) {
    app.directive('emitLastRepeaterElement', function () {
        return function (scope) {
            if (scope.$last) {
                scope.$emit('LastRepeaterElement');
            }
        };
    });
}(window.JP.getModule('docker')));
