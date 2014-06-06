'use strict';

(function (app) {
    app.directive('tooltipFullText', [
        function () {
            return {
                restrict: 'EA',
                link: function (scope, element) {
                    setTimeout(function () {
                        var elm = element[0];

                        // a tricky way to make this work correctly with different browsers
                        var lineHeight = parseInt(element.css('line-height'), 10) / 2;
                        var scrollHeight = elm.scrollHeight - lineHeight;
                        if (elm.offsetHeight < scrollHeight || elm.offsetWidth < elm.scrollWidth) {
                            element
                                .addClass('tooltip-hover')
                                .attr('data-toggle', 'tooltip')
                                .attr('data-placement', 'top')
                                .attr('data-html', 'true');

                            var text = elm.innerHTML.trim();

                            if (elm.offsetHeight < scrollHeight && text.split(' ').length > 1) {
                                while (text.length > 0 && element.context.scrollHeight > elm.offsetHeight) {
                                    text = text.substring(0, text.lastIndexOf(" "));
                                    element.context.innerHTML = text + '...';
                                }
                            }

                        }
                    }, 0);

                }
            };
        }]);
}(window.JP.getModule('Machine')));