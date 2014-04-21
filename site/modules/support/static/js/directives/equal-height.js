'use strict';

(function (app) {
    app.directive('equalHeight', ['$timeout',
        function ($timeout) {
            return {
                restrict: "A",
                link: function (scope, element, attrs) {
                    var selectors = attrs.equalHeight.split(', ');
                    if (typeof scope.$last === "undefined" || (scope.$last && attrs.ngRepeat)) {
                        // iteration is complete
                        $timeout(function () {
                            selectors.forEach(function (selector) {
                                var maxHeight = 0;
                                var $selector = $(selector);
                                $selector.each(function (index, el) {
                                    var thisHeight = el.offsetHeight;
                                    maxHeight = Math.max(maxHeight, thisHeight);
                                });
                                $selector.height(maxHeight);
                            });
                        });
                    }
                }
            };
        }]);
}(window.JP.getModule('support')));