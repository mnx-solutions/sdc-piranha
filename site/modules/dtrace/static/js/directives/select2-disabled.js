'use strict';

(function (app) {
    app.directive('select2Disabled', function () {
        return {
            restrict: 'A',
            scope: {
                select2Disabled: '='
            },
            link: function (scope, element) {
                scope.$watch('select2Disabled', function (state) {
                    state = state ? 'disable' : 'enable';
                    element.select2(state);
                });
            }
        };
    });
}(window.JP.getModule('dtrace')));
