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

                            var text = elm.innerHTML.trim();
                            if (elm.offsetHeight < (elm.scrollHeight - 5) && text.split(' ').length > 1) {

                                var t = element.clone().hide().css({
                                    'position': 'absolute',
                                    'width': 'auto',
                                    'overflow': 'visible',
                                    'max-width': 'inherit'
                                });

                                element.after(t);

                                while (text.length > 0 && t.context.scrollHeight > elm.offsetHeight) {
                                    text = text.substring(0, text.lastIndexOf(" "));
                                    t.context.innerHTML = text + '...';
                                }
                                elm.innerHTML = text + '...';
                            }

                        }
                    }, 0);

                }
            };
        }]);
}(window.JP.getModule('Machine')));