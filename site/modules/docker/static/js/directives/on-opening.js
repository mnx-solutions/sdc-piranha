'use strict';

(function (app) {
    app.directive('onOpening', function () {
        return {
            scope: {
                onOpening: '&'
            },
            link: function (scope, element) {
                element.on('opening', function () {
                    scope.onOpening();
                    scope.$apply();
                });
            }
        };
    });
}(window.JP.getModule('docker')));
