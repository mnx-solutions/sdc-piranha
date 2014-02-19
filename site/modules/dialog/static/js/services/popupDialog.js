'use strict';

(function (app) {

    app.factory('PopupDialog', ["$dialog", function ($dialog) {

        var factory = {};

        factory.confirm = function (title, question, callback) {
            // TODO: Translate
            title = title || 'Confirm';
            var btns = [
                {
                    result: 'cancel',
                    label: 'No',
                    cssClass: 'btn grey_new',
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

            return $dialog.messageBox(title, question, btns, 'dialog/static/partials/confirmationDialog.html')
                .open()
                .then(function (result) {
                    if (result === 'ok') {
                        callback();
                    }
                });
        };

        factory.error = function (title, question, callback) {
            // TODO: Translate
            title = title || 'Error';
            var btns = [
                {
                    result: 'ok',
                    label: 'Ok',
                    cssClass: 'btn orange',
                    setFocus: true
                }
            ];

            return $dialog.messageBox(title, question, btns, 'dialog/static/partials/errorDialog.html')
                .open()
                .then(function (result) {
                    if (result === 'ok') {
                        callback();
                    }
                });
        };
        factory.message = function (title, question, callback) {
            // TODO: Translate
            title = title || 'Message';
            var btns = [
                {
                    result: 'ok',
                    label: 'Ok',
                    cssClass: 'btn orange',
                    setFocus: true
                }
            ];

            return $dialog.messageBox(title, question, btns, 'dialog/static/partials/messageDialog.html')
                .open()
                .then(function (result) {
                     callback();
                });
        };

        factory.custom = function (opts, callback) {
            var title = opts.title || 'Message';
            var question = opts.question || '';
            var btns = opts.btns || [];
            var templateUrl = opts.templateUrl || 'dialog/static/partials/messageDialog.html';
            var openCtrl = opts.openCtrl;

            if (typeof callback !== 'function') {
                callback = function () {};
            }

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
