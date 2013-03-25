'use strict';

// I provide a non propagating shell for events
window.JP.main.service(
    'EventBubble',
    ['$rootScope', function ($rootScope) {
        return {
            '$new': function () {
                var $s = $rootScope.$new(true);
                var $on = $s.$on;

                $s.$on = function (event, listener) {
                    return $on.call($s, event, function (e) {
                        e.stopPropagation();
                        listener.apply($s, Array.prototype.slice.call(arguments, 1));
                    });
                };
                return $s;
            }
        }
    }]
);