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
            var title = title || 'Confirm';
            var btns = [
                {
                    result: 'cancel',
                    label: 'Cancel'
                },
                {
                    result:'ok',
                    label: 'OK',
                    cssClass: 'btn-primary'
                }
            ];

            $dialog.messageBox(title, question, btns)
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