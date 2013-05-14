'use strict';

// I provide a non propagating shell for events
window.JP.main.service(
    'EventBubble',
    ['$rootScope', function ($rootScope) {
        return {
            '$new': function () {
                var $s = $rootScope.$new(true);
                var $on = $s.$on;
                var $emit = $s.$emit;
                var eventList = {};

                $s.$on = function (event, listener) {
                    eventList[event] = eventList[event] || [];
                    var count = 0;
                    var unregister = $on.call($s, event, function (e) {
                        if(++count === eventList[event].length) {
                            e.stopPropagation();
                            count = 0;
                        }
                        listener.apply($s, Array.prototype.slice.call(arguments, 1));
                    });
                    var wrapper = function () {
                        delete eventList[event][eventList[event].indexOf(wrapper)];
                        return unregister();
                    };
                    eventList[event].push(wrapper);
                    return wrapper;
                };
                $s.$emit = function (force, arg1, arg2, arg3, arg4) {
                    var args = [];
                    var event = null;
                    if (typeof force !== 'boolean') {
                        event = force;
                        args = [force, arg1, arg2, arg3, arg4];
                        force = false;
                    } else {
                        event = arg1;
                        args = [arg1, arg2, arg3, arg4];
                    }
                    if(!force && (!eventList[event] || eventList[event].length < 1)){
                        return false;
                    }

                    $emit.apply($s, args);
                };
                return $s;
            }
        };
    }]
);