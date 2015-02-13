'use strict';

(function (ng, app) {
    app.factory('notification', ['$rootScope', 'PopupDialog', '$location', function ($rootScope, PopupDialog, $location) {
        return {
            success: function (message, settings) {
                $rootScope.$emit('notification', ng.extend(settings || {}, {theme: 'success', message: message}));
            },
            error: function (message, settings) {
                $rootScope.$emit('notification', ng.extend(settings || {}, {theme: 'error', message: message}));
            },
            popup: function (isPopup, isError, path, title, message, notificationMessage, callback) {
                var isOnRequiredPage = $location.path().indexOf(path) !== -1 &&
                    $location.path().indexOf('/compute/create') === -1 &&
                    $location.path().indexOf('/manta/jobs/') === -1;
                if (typeof (notificationMessage) === 'function') {
                    callback = notificationMessage;
                    notificationMessage = null;
                }
                notificationMessage = notificationMessage || message;

                if (!isOnRequiredPage) {
                    this[isError ?  'error' : 'success'](notificationMessage);
                } else if (isPopup) {
                    PopupDialog[isError ?  'error' : 'message'](title, message, callback);
                }
            }
        };
    }]);
}(window.angular, window.JP.getModule('notification')));