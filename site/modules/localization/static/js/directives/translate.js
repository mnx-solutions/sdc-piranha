'use strict';

(function (app) {
    app.directive('translate', [ 'localization', '$compile',
        function (localization, $compile) {

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
                element.text(
                    localization.translate(
                        scope,
                        identifier,
                        count
                    )
                );

                $compile(element.contents())(scope);
            }

            return {
                priority: 10,
                restrict: 'EA',
                compile: function compile(element, attrs) {
                    var identifier = element.text();

                    return function preLink(scope, element, attrs) {
                        // For pluralizing
                        var countVariable = null;
                        var countValue = 0;

                        if (attrs.hasOwnProperty('count')) {
                            countVariable = attrs.count;

                            if (scope.hasOwnProperty(countVariable)) {
                                countValue = scope[countVariable];
                            }
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
                    };

                }
            };
    }]);
}(window.JP.getModule('localization')));
