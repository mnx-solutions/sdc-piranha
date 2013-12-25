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
            title = title || 'Confirm';
            var btns = [
                {
                    result: 'cancel',
                    label: 'Cancel',
                    cssClass: 'pull-left'
                },
                {
                    result:'ok',
                    label: 'OK',
                    cssClass: 'btn-joyent-blue'
                }
            ];

            return $dialog.messageBox(title, question, btns)
                .open()
                .then(function (result) {
                    if (result === 'ok') {
                        callback();
                    }
                });
        };

        service.clone = function clone (obj) {
            if (!obj || typeof obj !== 'object') {
                return obj;
            }

            var ret = {};
            if (window.angular.isArray(obj)) {
                ret = [];
                obj.forEach(function (el) {
                    ret.push(clone(el));
                });
                return ret;
            }

            Object.keys(obj).forEach(function (key) {
                if (key.indexOf('$') !== 0 && key !== 'job') {
                    ret[key] = clone(obj[key]);
                }
            });

            return ret;
        };

        service.error = function (title, question, callback) {
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

            return $dialog.messageBox(title, question, btns)
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