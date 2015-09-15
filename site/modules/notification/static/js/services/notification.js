'use strict';

(function (ng, app) {
    app.factory('notification', ['$rootScope', 'PopupDialog', '$location', 'localization',
        function ($rootScope, PopupDialog, $location, localization) {
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
                    if (typeof notificationMessage === 'function') {
                        callback = notificationMessage;
                        notificationMessage = null;
                    }
                    notificationMessage = notificationMessage || message;

                    if (!isOnRequiredPage) {
                        this[isError ? 'error' : 'success'](notificationMessage);
                    } else if (isPopup) {
                        PopupDialog[isError ? 'error' : 'message'](title, message, callback);
                    }
                },
                getMessage: function (errorMessage, err, isPopupMessage) {
                    var addDot = function (message) {
                        var DOT = '.';
                        if (typeof message === 'string' && message[message.length - 1] !== DOT) {
                            message += DOT;
                        }
                        return message;
                    };
                    errorMessage = errorMessage || '';
                    if (err && err.restCode === 'NotAuthorized') {
                        errorMessage = err.message;
                    } else if (err && isPopupMessage) {
                        errorMessage += ' ' + (err.message || err);
                    }
                    return localization.translate(null, null, addDot(errorMessage));
                },
                notify: function (path, errMessage, err, callback) {
                    if (typeof err === 'function') {
                        callback = err;
                        err = null;
                    }
                    var popupMessage = this.getMessage(errMessage, err, true);
                    var notificationMessage = this.getMessage(errMessage, err, false);
                    this.popup(err, err, path, null, popupMessage, notificationMessage, callback);
                }
            };
        }
    ]);
}(window.angular, window.JP.getModule('notification')));