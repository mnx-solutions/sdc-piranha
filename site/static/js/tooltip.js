'use strict';

(function($) {
    $(function () {

        $(document)
            .on('mouseenter', '.tooltip-hover[disabled!="disabled"]', function () {
                $(this).tooltip('show');
            })
            .on('mouseleave', '.tooltip-hover[disabled!="disabled"]', function () {
                $(this).tooltip('hide');
            });
    });
}(window.jQuery));