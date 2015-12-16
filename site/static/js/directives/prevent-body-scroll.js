'use strict';

(function (app) {
    app.directive('preventBodyScroll', [function () {
        return {
            restrict: 'A',
            scope: {},
            link: function (scope, element) {
                var preventScrollDown = function (event) {
                    var scrollHeight = element[0].scrollHeight;
                    var height = element.height();
                    var WHEEL_DELTA_MULTIPLIER = -40;
                    var delta = event.type === 'DOMMouseScroll' ? event.originalEvent.detail * WHEEL_DELTA_MULTIPLIER : event.originalEvent.wheelDelta;

                    if (delta < 0 && scrollHeight !== height && scrollHeight - height - element[0].scrollTop === 0) {
                        event.stopPropagation();
                        event.preventDefault();
                        event.returnValue = false;
                    }
                };

                element.mouseenter(function () {
                    element.on('mousewheel DOMMouseScroll', preventScrollDown);
                });

                element.mouseleave(function () {
                    element.off('mousewheel DOMMouseScroll', preventScrollDown);
                });
            }
        }
    }]);
}(window.JP.main));
