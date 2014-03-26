'use strict';

window.JP.main.service('util', [

    function () {
        var service = {};

        service.isPrivateIP = function isPrivateIP(ip) {
            var parts = ip.split('.');

            return +parts[0] === 10 ||
                (+parts[0] === 172 && (+parts[1] >= 16 && +parts[1] <= 31)) ||
                (+parts[0] === 192 && +parts[1] === 168);
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

        service.getReadableFileSizeString = function (bytes) {
            if (bytes === 0) {
                return '0 Bytes';
            }
            var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
            return {
                value: Math.round(bytes / Math.pow(1024, i), 2) || 0,
                measure: sizes[i]
            };
        };

        return service;
    }]
);
