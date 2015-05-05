'use strict';

(function (ng, app) {

    app.factory('Select2overlay', [function () {
        var autoScroll = false;
        var wnd = ng.element(window);

        var showTabs = function () {
            ng.element('#zenbox_tab').show();
            ng.element('.feedback-tab').show();
        };

        var beginScroll = function (scrollContainer, scrollPosition) {
            scrollContainer.animate({scrollLeft: scrollPosition}, 0, function () {
                setTimeout(function () {
                    autoScroll = false;
                }, 100);
            });
        };

        var openHandler = function (e) {
            var mask = ng.element('#select2-drop-mask');
            var drop = ng.element('#select2-drop');
            var zenbox = ng.element('#zenbox_tab');
            var leftMenu  = ng.element('.left-side-menu');
            var header = ng.element('.header');
            var rightTabsBorder = 3;
            var leftPadding = 45;
            if ((drop.offset().left - wnd.scrollLeft() - 20) < leftMenu.width()) {
                autoScroll = true;
                var gridTabs = ng.element('.grid-tabs-container');
                var scrollContainer = ng.element('body, html');
                var scrollPosition = drop.offset().left - ng.element('.container-position').position().left - leftPadding;
                beginScroll(scrollContainer, scrollPosition);

                if (gridTabs.length > 0) {
                    scrollContainer = ng.element('.item-list-container');
                    scrollPosition = drop.offset().left - gridTabs.offset().left;
                    if ((drop.offset().left - scrollContainer.scrollLeft() - 20) < leftMenu.width()) {
                        beginScroll(scrollContainer, scrollPosition);
                    }
                }
            }
            if (zenbox.length && zenbox.offset().left < drop.offset().left + drop.width() + rightTabsBorder) {
                ng.element('.feedback-tab').hide();
                zenbox.hide();
            }
            wnd.bind('popstate resize', function (e) {
                showTabs();
                mask.mousedown();
                mask.remove();
            });
            wnd.bind('scroll', function (e) {
                if (!autoScroll) {
                    if (drop.length && (header.offset().top >= drop.offset().top - header.height() ||
                        header.offset().left >= drop.offset().left - leftMenu.width())) {
                        mask.mousedown();
                    }
                }
            });
            e.preventDefault();
        };

        var closeHandler = function (e) {
            wnd.unbind('popstate');
            wnd.unbind('scroll');
            wnd.unbind('resize');
            showTabs();
            e.preventDefault();
        };

        return {
            openHandler: openHandler,
            closeHandler: closeHandler
        }
    }]);
}(window.angular, window.JP.getModule('Menu')));
