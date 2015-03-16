'use strict';

(function (app) {
    app.directive('createDtraceButton', [function () {
        return {
            restrict: 'EA',
            templateUrl: 'dtrace/static/partials/create-dtrace-button.html'
        };
    }]);
}(window.JP.getModule('dtrace')));
