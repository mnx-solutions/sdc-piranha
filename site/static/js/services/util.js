'use strict';

window.JP.main.service('util', [
    '$dialog',
    function ($dialog) {
        var service = {};

        service.isPrivateIP = function isPrivateIP(ip) {
            var parts = ip.split('.');

            if (+parts[0] === 10 ||
                (+parts[0] === 172 && (+parts[1] >= 16 && +parts[1] <= 31)) ||
                (+parts[0] === 192 && +parts[1] === 168)) {
                return true;
            }

            return false;
        };

        service.confirm = function (title, question, callback) {
            // TODO: Translate
            var title = 'Confirmation';
//            var title = title || 'Confirmation';
            var btns = [
                {
                    result: 'cancel',
                    label: 'No',
                    cssClass: 'btn grey_new',
                    datatabindex: "1"
                },
                {
                    result:'ok',
                    label: 'Yes',
                    cssClass: 'btn orange',
                    datatabindex: "2"
                }
            ];

            var templateUrl = 'dashboard/static/template/dialog/confirmationDialog.html';

            $dialog.messageBox(title, question, btns, templateUrl)
                .open()
                .then(function (result) {
                    if (result === 'ok') {
                        callback();
                    }
                });
        };

        service.error = function (title, question, callback) {
            // TODO: Translate
            var title = 'Error';
//            var title = title || 'Error';
            var btns = [
                {
                    result:'ok',
                    label: 'Ok',
                    cssClass: 'btn orange'
                }
            ];

            var templateUrl = 'dashboard/static/template/dialog/errorDialog.html';

            $dialog.messageBox(title, question, btns, templateUrl)
                .open()
                .then(function (result) {
                    if (result === 'ok') {
                        callback();
                    }
                });
        };
        service.message = function (title, question, callback) {
            // TODO: Translate
            var title = 'Message';
//            var title = title || 'Message';
            var btns = [
                {
                    result:'ok',
                    label: 'Ok',
                    cssClass: 'btn orange'
                }
            ];

            var templateUrl = 'dashboard/static/template/dialog/messageDialog.html';

            $dialog.messageBox(title, question, btns, templateUrl)
                .open()
                .then(function (result) {
                    if (result === 'ok') {
                        callback();
                    }
                });
        };

        return service;
    }]
);