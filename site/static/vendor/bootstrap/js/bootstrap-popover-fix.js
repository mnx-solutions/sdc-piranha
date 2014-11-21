(function($) {
    var originalLeave = $.fn.popover.Constructor.prototype.leave;
    $.fn.popover.Constructor.prototype.leave = function(obj) {
        var self = (obj instanceof this.constructor ? obj : $(obj.currentTarget)[this.type](this.getDelegateOptions()).data("bs." + this.type));
        originalLeave.call(this, obj);
        if (obj.currentTarget) {
            var current = $(obj.currentTarget);
            var container = current.siblings(".popover");
            container.on("mouseenter", function() {
                clearTimeout(self.timeout);
            });
            container.on("mouseleave", function() {
                originalLeave.call(self, self);
            });
        }
    };

    var originalEnter = $.fn.popover.Constructor.prototype.enter;
    $.fn.popover.Constructor.prototype.enter = function(obj) {
        var self = (obj instanceof this.constructor ? obj : $(obj.currentTarget)[this.type](this.getDelegateOptions()).data("bs." + this.type));
        clearTimeout(self.timeout);
        if (!$(obj.currentTarget).siblings(".popover:visible").length) {
            originalEnter.call(this, obj);
        }
    };
})(jQuery);
