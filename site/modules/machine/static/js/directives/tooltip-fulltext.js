'use strict';

(function (app) {
    app.directive('tooltipFullText', [
        function () {
            return {
                restrict: 'EA',
                link: function (scope, element, attrs) {
                    setTimeout(function () {
                        var elm = element[0];

                        // a tricky way to make this work correctly with different browsers
                        var lineHeight = parseInt(element.css('line-height'), 10) / 2;
                        var scrollHeight = elm.scrollHeight - lineHeight;
                        if (elm.offsetHeight < scrollHeight || elm.offsetWidth < elm.scrollWidth) {

                            var text = elm.innerHTML.trim();
                            var label = ' <span class="label label-default tooltip-hover" data-toggle="tooltip" data-placement="top" data-html="true" data-original-title=" ' + attrs.originalTitle + '">...</span>';

                            if (elm.offsetHeight < scrollHeight && text.split(' ').length > 1) {
                                while (text.length > 0 && element.context.scrollHeight > elm.offsetHeight) {
                                    text = text.substring(0, text.lastIndexOf(" "));
                                    element.context.innerHTML = text + label;
                                }
                            } else if (text.length > 100 && text.split(' ').length === 1) {
                                text = text.substring(100, 0);
                                element.context.innerHTML = text + label;
                            }
                        }
                    }, 0);

                }
            };
        }]);
}(window.JP.getModule('Machine')));