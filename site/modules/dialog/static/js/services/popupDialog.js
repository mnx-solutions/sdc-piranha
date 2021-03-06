'use strict';

(function (ng, app) {

    app.factory('PopupDialog', ["$dialog", "$location", "$rootScope", "localization", function ($dialog, $location, $rootScope, localization) {

        var factory = {};
        var dialog;
        var messages;
        var initMessages = function (force) {
            if (!messages || !messages.parts || force) {
                messages = {
                    parts: [],
                    concatenated: ''
                };
            }
        };
        initMessages();
        var messageBox = function (title, question, btns, templateUrl, callbackOk, callbackCancel) {
            if (angular.isString(question)) {
                initMessages();
            }
            callbackOk = callbackOk || angular.noop;
            callbackCancel = callbackCancel || angular.noop;
            var isNew = messages.parts.length === 0;
            var message = question.error || question;
            if (ng.isObject(message) && !Array.isArray(message)) {
                messages = message;
            } else if (Array.isArray(message)) {
                message.forEach(function (mes) {
                    var part = mes.error || mes;
                    if (messages.parts.join().indexOf(part) === -1) {
                        messages.parts.push(part);
                        messages.concatenated = messages.parts.join('<br/>');
                    }
                });
            } else if (messages.parts.join().indexOf(message) === -1) {
                messages.parts.push(message);
                messages.concatenated = messages.parts.join('<br/>');
            }
            if (!dialog || isNew) {
                dialog =  $dialog.messageBox(title, messages, btns, templateUrl)
                    .open()
                    .then(function (result) {
                        initMessages(true);
                        if (result === 'ok') {
                            callbackOk();
                        } else {
                            callbackCancel();
                        }
                    });
                return dialog;
            }
        };

        factory.confirm = function (title, question, callbackOk, callbackCancel) {
            // TODO: Translate
            title = title || 'Confirm';
            var btns = [
                {
                    result: 'cancel',
                    label: 'No',
                    cssClass: 'btn grey',
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


        factory.confirmAction = function (confirmTitle, action, itemName, itemAmount, confirmMessage, callbackOk, callbackCancel) {
            var singleName = itemName.single || itemName;
            var pluralName = itemName.plural || itemName + 's';
            if (!itemAmount) {
                return factory.noItemsSelectedError(pluralName);
            }
            itemName = itemAmount > 1 ? pluralName : singleName;
            if (typeof confirmMessage === 'function') {
                callbackCancel = callbackOk;
                callbackOk = confirmMessage;
                confirmMessage = null;
            }
            var title =  localization.translate(
                null,
                null,
                'Confirm: {{confirm}}.',
                {confirm: confirmTitle}
            );
            if (confirmMessage) {
                confirmMessage = (itemAmount > 1 ? confirmMessage.plural : confirmMessage.single) || confirmMessage;
            }
            var question = localization.translate(
                null,
                null,
                confirmMessage || 'Please confirm that you want to {{action}} {{additional}} {{item}}.',
                {action: action, additional: itemAmount > 1 ? 'selected' : 'this',  item:  itemName}
            );

            factory.confirm(title, question, callbackOk, callbackCancel);
        };

        factory.error = function (title, question, callback) {
            if ((ng.isObject(question) && !question.error && !Array.isArray(question)) || question.code === 'EHOSTUNREACH') {
                return;
            }
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
            return messageBox(title, question, btns, 'dialog/static/partials/errorDialog.html', callback, callback);
        };

        factory.errorProvision = function (submitBillingInfo, locationCb, showPopUp) {
            var returnUrl = $location.path();
            locationCb = locationCb || function () {
                $location.path(returnUrl);
            };
            if (submitBillingInfo) {
                var message = submitBillingInfo.appendPopupMessage;
                submitBillingInfo.appendPopupMessage = message ? ' ' + message : '';
            }
            var callback = function () {
                $rootScope.commonConfig('returnCb',  locationCb);
                $rootScope.commonConfig('submitBillingInfo', submitBillingInfo);
                $location.path('/account/payment');
            };

            if (typeof (showPopUp) === 'boolean' && !showPopUp) {
                return callback();
            }
            return factory.message('Attention', 'Please complete the profile information before proceeding.' + (submitBillingInfo.beforeBillingMessage || ''), callback);
        };

        factory.errorObj = function (error, callback, customMessage) {
            var message = customMessage || error.message || error;
            return factory.error('Error', message, callback);
        };

        factory.noItemsSelectedError = function (itemName) {
            return factory.error(
                localization.translate(null, null, 'Error'),
                localization.translate(null, null, 'No ' + itemName + ' selected for the action.')
            );
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
            return messageBox(title, question, btns, 'dialog/static/partials/messageDialog.html', callback, callback);
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
}(window.angular, window.JP.getModule('Dialog')));

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
