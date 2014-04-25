'use strict';

(function (app) {

    app.factory('PopupDialog', ["$dialog", function ($dialog) {

        var factory = {};

        var messageBox = function (title, question, btns, templateUrl, callbackOk, callbackCancel) {
            callbackOk = callbackOk || angular.noop;
            callbackCancel = callbackCancel || angular.noop;
            return $dialog.messageBox(title, question, btns, templateUrl)
                    .open()
                    .then(function (result) {
                        if (result === 'ok') {
                            callbackOk();
                        } else if (result === 'cancel') {
                            callbackCancel();
                        } else {
                            callbackOk();
                        }
                    });
        };

        factory.confirm = function (title, question, callbackOk, callbackCancel) {
            // TODO: Translate
            title = title || 'Confirm';
            var btns = [
                {
                    result: 'cancel',
                    label: 'No',
                    cssClass: 'btn grey-new effect-orange-button',
                    datatabindex: "1",
                    setFocus: false
                },
                {
                    result: 'ok',
                    label: 'Yes',
                    cssClass: 'btn orange',
                    datatabindex: "2",
                    setFocus: true
                }
            ];
            return messageBox(title, question, btns, 'dialog/static/partials/confirmationDialog.html', callbackOk, callbackCancel);
        };

        factory.error = function (title, question, callback) {
            // TODO: Translate
            title = title || 'Error';
            var btns = [
                {
                    result: 'ok',
                    label: 'Ok',
                    cssClass: 'btn orange',
                    setFocus: true
                }
            ];
            return messageBox(title, question, btns, 'dialog/static/partials/errorDialog.html', callback);
        };

        factory.errorObj = function (error, callback, customMessage) {
            var message;
            if (error.statusCode === 403) {
                callback = function () {
                    location.href = '/#!/account/payment';
                };
                message = error.message || 'Payment Method Required: To be able to provision you must update your payment method';
            } else if (error.message) {
                message = error.message;
            } else if (typeof (error) === 'string') {
                message = error;
            }
            return factory.error('Error', customMessage || message, callback);
        };

        factory.message = function (title, question, callback) {
            // TODO: Translate
            title = title || 'Message';
            var btns = [
                {
                    result: 'ok',
                    label: 'Ok',
                    cssClass: 'btn orange',
                    setFocus: true
                }
            ];
            return messageBox(title, question, btns, 'dialog/static/partials/messageDialog.html', callback);
        };

        factory.custom = function (opts, callback) {
            var title = opts.title || 'Message';
            var question = opts.question || '';
            var btns = opts.btns || [];
            var templateUrl = opts.templateUrl || 'dialog/static/partials/messageDialog.html';
            var openCtrl = opts.openCtrl;

            callback = callback || angular.noop;
            return $dialog.messageBox(title, question, btns, templateUrl)
                    .open('', openCtrl)
                    .then(function (data) {
                        callback(data);
                    });
        };

        return factory;
    }]);
}(window.JP.getModule('Dialog')));

window.JP.main.directive('buttonFocus', [
    function () {
        return {
            restrict: 'A',
            replace: false,
            scope: false,
            link: function (scope, element, attrs) {

                attrs.$observe('buttonFocus', function (value) {

                    if (value === 'true') {
                        element.focus();
                    }

                });
            }
        };
    }
]);
