'use strict';

(function (app) {
    app.directive('flowPlayer', function () {
        return function (scope, element, attrs) {
            flowplayer.conf.embed = false
            element.flowplayer();
        };
    });
}(window.JP.getModule('Storage')));