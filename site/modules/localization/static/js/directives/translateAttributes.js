'use strict';

(function (app) {
    app.directive('translateAttributes', [ 'localization', '$compile', '$interpolate',
        function (localization, $compile, $interpolate) {

            return {
                priority: 10,
                restrict: 'EA',
                compile: function compile(tElement, tAttrs, transclude) {
                    return function link(scope, element, attrs) {

                        // for translating other attributes
                        if (attrs.translateAttributes.length > 0) {
                            var translateAttrs = attrs.translateAttributes.split(',');

                            translateAttrs.forEach(function (attr) {

                                if(attr === 'no-value') {
                                    translate = false;
                                } else {
                                    attrs.$observe(attr,
                                        function (value) {
                                            element.attr(attr, localization.translate(
                                                localization.resolveScope(scope),
                                                attrs.translateModule,
                                                element.attr(attr),
                                                0
                                            ));
                                        });
                                }
                            });
                        }
                    };
                }
            };
        }]);
}(window.JP.getModule('localization')));
