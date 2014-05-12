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
                        setTimeout(function () {
                            scope.$apply(function () {
                                scope.changingName = false;
                            });
                        }, 200);
                    });
                }
            };
        }]);
}(window.JP.getModule('Machine')));