'use strict';

(function (app) {
    app.directive('tooltipFullText', [
        function () {
            return {
                restrict: 'EA',
                link: function (scope, element, attrs) {
                    var type = attrs.type || 'label';
                    setTimeout(function () {
                        var elm = element[0];
                        // a tricky way to make this work correctly with different browsers
                        var lineHeight = parseInt(element.css('line-height'), 10) / 2;
                        var scrollHeight = elm.scrollHeight - lineHeight;
                        var text = elm.innerHTML.trim();
                        var label = ' <span class="label label-default tooltip-hover" data-toggle="tooltip" data-placement="top" data-html="true" data-original-title=" ' + text + '">...</span>';
                        function setLabel() {
                            if (text.split(' ').length > 1) {
                                text = text.substring(0, text.lastIndexOf(' '));
                            } else {
                                text = text.substring(0, text.length - 1);
                            }
                            element.context.innerHTML = text + label;
                        }
                        if (elm.offsetHeight < scrollHeight && elm.offsetWidth >= elm.scrollWidth) {
                            while (text.length > 0 && element.context.scrollHeight > elm.offsetHeight) {
                                setLabel();
                            }
                        }
                        if (elm.offsetWidth < elm.scrollWidth - 1 && elm.offsetHeight >= scrollHeight) {
                            if (type === 'dotdotdot') {
                                element
                                    .addClass('tooltip-hover')
                                    .attr('data-toggle', 'tooltip')
                                    .attr('data-placement', 'top')
                                    .attr('data-html', 'true');
                            } else {
                                while (text.length > 0 && element.context.scrollWidth > elm.offsetWidth) {
                                    setLabel();
                                }
                            }
                        }
                    }, 0);
                }
            };
        }]);
}(window.JP.getModule('Machine')));