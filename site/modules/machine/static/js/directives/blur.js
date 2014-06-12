'use strict';

(function (app) {
    app.directive('blur', [
        function () {
            return {
                link: function (scope, elm) {
                    elm.on('focus', function () {
                        scope.$apply(function () {
                            scope.changingName = true;
                        });
                    });

                    elm.on('blur', function () {
                        scope.clearNameTimeout = setTimeout(function () {
                            scope.$apply(function () {
                                scope.changingName = false;
                                scope.newName = '';
                            });
                        }, 200);
                    });
                }
            };
        }]);
}(window.JP.getModule('Machine')));