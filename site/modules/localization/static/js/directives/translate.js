'use strict';

(function (app) {
    app.directive('translate', [ 'localization', '$compile', '$interpolate',
        function (localization, $compile, $interpolate) {

            /**
             * Handle scope & locale changes
             *
             * @private
             * @param scope controller scope
             * @param element current element
             * @param attrs current element attributes
             * @param identifier translation identifier
             * @param count items count (for pluralizing)
             */
            function onChange(scope, element, attrs, identifier, count) {
                // Observer module attribute if it is not resolved
                if (attrs.$attr.translateModule && !attrs.translateModule) {
                    attrs.$observe(attrs.$attr.translateModule, function () {
                        onChange(scope, element, attrs, identifier, count);
                    });
                } else {
                    element.text(
                        localization.translate(
                            localization.resolveScope(scope),
                            attrs.translateModule,
                            identifier,
                            {},
                            count
                        )
                    );

                    $compile(element.contents())(scope);
                }
            }

            return {
                priority: 10,
                restrict: 'EA',

                link: function link(scope, element, attrs) {
                    var identifier = null;

                    // manipulate the element a bit and get rid of newlines + unneccessary spaces
                    var elementText = element.text().replace(/(\r\n|\n|\r)/gm, '').replace(/\s+/g,' ').trim();

                    // Interpolate expression
                    if (attrs.translateExpression) {
                        var expression = $interpolate(elementText);
                        identifier = expression(scope);
                    } else {
                        identifier = elementText;
                    }

                    // For pluralizing
                    var countVariable = null;
                    var countValue = 0;

                    if (attrs.hasOwnProperty('count')) {
                        countVariable = attrs.count;

                        if (scope.hasOwnProperty(countVariable)) {
                            countValue = scope[countVariable];
                        }
                    }

                    // for translating other attributes
                    if (attrs.translate.length > 0) {
                        var translateAttrs = attrs.translate.split(',');

                        translateAttrs.forEach(function (attr) {
                            attrs.$observe(attr,
                                function (value) {
                                    element.attr(attr, localization.translate(
                                        localization.resolveScope(scope),
                                        attrs.translateModule,
                                        element.attr(attr),
                                        0
                                ))
                            })
                        })
                    }

                    // When locale changes
                    scope.$on('localization:change', function () {
                        onChange(scope, element, attrs, identifier, countValue);
                    });

                    // Watch for count variable changes
                    if (countVariable) {
                        scope.$watch(countVariable,
                            function (newValue, oldValue, scope) {
                                countValue = newValue;
                                onChange(scope, element, attrs, identifier, countValue);
                            });
                    }

                    onChange(scope, element, attrs, identifier, countValue);
                }
            };
    }]);
}(window.JP.getModule('localization')));
