'use strict';

(function (app) {

    app.factory('PopupDialog', ["$dialog", "$location", "$rootScope", function ($dialog, $location, $rootScope) {

        var factory = {};

        var messageBox = function (title, question, btns, templateUrl, callbackOk, callbackCancel) {
            callbackOk = callbackOk || angular.noop;
            callbackCancel = callbackCancel || angular.noop;
            return $dialog.messageBox(title, question, btns, templateUrl)
                    .open()
                    .then(function (result) {
                        if (result === 'ok') {
                            callbackOk();
                        } else {
                            callbackCancel();
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
            } else {
                var isFreeTier = function (cb) {
                    var freeTierExists = false;
                    setTimeout(function () {
                        var provisionBundle = $rootScope.commonConfig('provisionBundle');
                        if (provisionBundle) {
                            freeTierExists = provisionBundle.machine.freetier;
                        }
                        cb(null, freeTierExists);
                    }, 100);
                };
                isFreeTier(function (err, freeTierExists) {
                    var freeTierNote = '';
                    if (freeTierExists) {
                        freeTierNote = ' Note: Free Dev Tier customers will not be billed until the promotional term expires as this is merely a validation step.';
                    }
                    return factory.message('Attention', 'Please complete the profile information before proceeding.' + freeTierNote, callback);
                });
                return null;
            }
        };

        factory.errorObj = function (error, callback, customMessage) {
            var message = customMessage || error.message || error;
            return factory.error('Error', message, callback);
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
