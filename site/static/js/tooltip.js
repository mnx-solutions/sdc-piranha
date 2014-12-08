'use strict';

(function($) {
    $(function () {
        function closeTooltips() {
            $('.show-on-click').each(function () {
                var $this = $(this);
                if ($this.data('isShowing')) {
                    $this.data('isShowing', false);
                    $this.tooltip('hide');
                }
            });
        }
        $(document)
            .on('mouseenter', '.tooltip-hover[disabled!="disabled"]', function () {
                $(this).tooltip('show');
            })
            .on('mouseleave', '.tooltip-hover[disabled!="disabled"]', function () {
                $(this).tooltip('hide');
            })
            .on('click', 'body', function () {
                closeTooltips();
            })
            .on('click', '.show-on-click[disabled!="disabled"]', function (e) {
                e.preventDefault();
                e.stopPropagation();
                closeTooltips();
                var $this = $(this);
                if ($this.data('isShowing')) {
                    $this.data('isShowing', false);
                    $this.tooltip('hide');
                } else {
                    $this.data('isShowing', true);
                    $this.tooltip({
                        animation: false,
                        trigger: 'click'
                    });
                    $this.tooltip('show');
                }
            });
    });
}(window.jQuery));