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

        return service;
    }]
);
