// The smallest jQuery Overlay
$.fn.overlay = function () {

    var ACTIVE = "is-active";

    function toggle(el) {
        $("body").toggleClass("is-overlayed", !!el);

        if (el) {
            el.addClass(ACTIVE).trigger("open");
        } else {
            els.filter("." + ACTIVE).removeClass(ACTIVE).trigger("close");
        }
    }

// trigger elements
    var els = this.click(function () {
        toggle($(this));
    });

// esc key
    $(document).keydown(function (e) {
        if (e.which == 27) {
            toggle();
        }
    });

// close
    $(".close", this).click(function (e) {
        toggle();
        e.stopPropagation();
    });

    return els;
};

$(function () {
    // the player will fill the entire overlay
    // so we only need an overlay where inline video is supported
    if (flowplayer.support.inlineVideo) {

        // construct overlays
        $(".overlay").overlay().bind("close", function () {

            // when overlay closes -> unload flowplayer
            $(this).find(".flowplayer").data("flowplayer").unload();

        });
    }
});