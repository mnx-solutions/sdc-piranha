'use strict';

(function (app) {
    app.directive('tooltipFullText', [
        function () {
            return {
                restrict: 'EA',
                link: function (scope, element) {
                    setTimeout(function () {
                        var elm = element[0];
                        if (elm.offsetHeight < elm.scrollHeight || elm.offsetWidth < elm.scrollWidth) {
                            element
                                .addClass('tooltip-hover')
                                .attr('data-toggle', 'tooltip')
                                .attr('data-placement', 'top')
                                .attr('data-html', 'true');
                        }
                    }, 0);

                }
            };
        }]);
}(window.JP.getModule('Machine')));