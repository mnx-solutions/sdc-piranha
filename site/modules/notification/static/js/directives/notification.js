'use strict';

(function ($, app) {
    app.directive('notification', [ '$rootScope', function ($rootScope) {
        return {
            restrict: 'A',
            link: function () {
                var options = {
                    life: 10000,
                    sticky: true,
                    verticalEdge: 'right',
                    horizontalEdge: 'top'
                };
                $.notific8('zindex', 20000);
                $rootScope.$on(
                    'notification',
                    function (target, settings) {
                        var message = settings.message || '';
                        $.notific8(message, $.extend({}, options, settings));
                    }
                );
            }
        };
    }]);
}(window.jQuery, window.JP.getModule('notification')));