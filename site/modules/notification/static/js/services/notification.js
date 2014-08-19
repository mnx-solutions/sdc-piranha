'use strict';

(function (ng, app) {
    app.factory('notification', ['$rootScope', function ($rootScope) {

        return {
            success: function (message, settings) {
                $rootScope.$emit('notification', ng.extend(settings || {}, {theme: 'success', message: message}));
            },
            error: function (message, settings) {
                $rootScope.$emit('notification', ng.extend(settings || {}, {theme: 'error', message: message}));
            }
        };
    }]);
}(window.angular, window.JP.getModule('notification')));