'use strict';

(function (app) {
    app.directive('translateAttributes', [
        'localization',
        function (localization) {
            return {
                priority: 10,
                restrict: 'EA',

                compile: function compile (tElement, tAttrs, transclude) {
                    return function link (scope, element, attrs) {
                        if (attrs.translateAttributes.length > 0) {
                            var translateAttrs = attrs.translateAttributes.split(',');

                            for (var i = 0, c = translateAttrs.length; i < c; i++) {
                                var attr = translateAttrs[i];

                                if (!attr || attr.length !== 0 || attr === 'no-value') {
                                    attrs.$observe(attr,
                                        function () {
                                            element.attr(attr, localization.translate(
                                                localization.resolveScope(scope),
                                                attrs.translateModule,
                                                element.attr(attr),
                                                0
                                            ));
                                        });
                                }
                            }
                        }
                    };
                }
            };
        }]);
}(window.JP.getModule('localization')));
