'use strict';

(function (app) {
    app.directive('copyToClipboard', ['$compile', function ($compile) {
        return {
            restrict: 'E',
            scope: {
                path: '@'
            },
            link: function (scope, element) {
                var FLASH_PLAYER_PATH = 'http://www.macromedia.com/go/getflashplayer';
                var flashTemplate;
                var flashObject = null;

                try {
                    flashObject = new ActiveXObject('ShockwaveFlash.ShockwaveFlash');
                } catch (e) {}

                var shockwaveMimeType = navigator.mimeTypes && navigator.mimeTypes['application/x-shockwave-flash'];

                flashTemplate = flashObject !== null || shockwaveMimeType && shockwaveMimeType.enabledPlugin ?
                    '<object classid="clsid:d27cdb6e-ae6d-11cf-96b8-444553540000" width="150" height="20" class="pull-left" id="clippy" onclick="this.blur();">' +
                    '<param name="movie" value="/main/storage/static/vendor/swf/clippy.swf" />' +
                    '<param name="allowScriptAccess" value="always" />' +
                    '<param name="quality" value="high" />' +
                    '<param name="scale" value="noscale" />' +
                    '<param name="flashvars" value="text=' + scope.path + '">' +
                    '<param name="bgcolor" value="#FFFFFF">' +
                    '<embed src="/main/storage/static/vendor/swf/clippy.swf"' +
                    'onclick="this.blur();"' +
                    'width="150"' +
                    'height="20"' +
                    'name="clippy"' +
                    'quality="high"' +
                    'allowScriptAccess="always"' +
                    'type="application/x-shockwave-flash"' +
                    'pluginspage="' + FLASH_PLAYER_PATH + '"' +
                    'flashvars="text=' + scope.path + '"' +
                    'bgcolor="#FFFFFF" />' +
                    '</object>'
                    :
                    '<span class="pull-left">Get <a href="' + FLASH_PLAYER_PATH + '" target="_blank">Flash player</a>.</span>';

                var e = $compile(flashTemplate)(scope);
                element.replaceWith(e);
            }
        };
    }]);
}(window.JP.getModule('Storage')));
