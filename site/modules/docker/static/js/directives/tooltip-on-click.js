'use strict';

(function ($, app) {
    app.directive('tooltipOnClick', [
        function () {
            return {
                restrict: 'EA',
                link: function (scope, element) {
                    function closeTooltips() {
                        $('.show-on-click').each(function () {
                            var $this = $(this);
                            if ($this.data('isShowing')) {
                                $this.data('isShowing', false);
                            }
                        });
                        $('.tooltip').each(function () {
                            $(this).hide();
                        });
                    }
                    if ($('.item-list-container').html()) {
                        $('.item-list-container').on('scroll', function() {
                            closeTooltips();
                        });
                        $('.dropdown-checkboxes-item input').on('click', function() {
                            closeTooltips();
                        });
                    }
                    element.tooltip({
                        animation: false,
                        trigger: 'click'
                    });

                    element.on('click', function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        var $this = $(this);
                        if ($this.data('isShowing')) {
                            $this.data('isShowing', false);
                            $this.tooltip('hide');
                        } else {
                            $this.data('isShowing', true);
                            $this.tooltip('show');
                        }
                    });

                    $(document)
                        .on('click', '#button-columns, .dropdown-toggle, body', function () {
                            closeTooltips();
                        })
                        .on('show.bs.tooltip', function (e) {
                            $('.show-on-click').not(e.target).each(function () {
                                var $this = $(this);
                                $this.data('isShowing', false);
                                $this.tooltip('hide');
                            });
                        })
                        .on('wheel', function () {
                            closeTooltips();
                        });
                }
            };
        }]);
}(window.jQuery, window.JP.getModule('docker')));
