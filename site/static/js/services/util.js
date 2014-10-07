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

        service.getReadableFileSize = function (bytes) {
            var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)), 10);
            return {
                value: Math.round(bytes / Math.pow(1024, i), 2) || 0,
                measure: sizes[i] || sizes[0]
            };
        };

        service.getReadableFileSizeString = function (bytes) {
            var formatted = service.getReadableFileSize(bytes);
            return formatted.value + ' ' + formatted.measure;
        };

        service.getReadableDramUsage = function (num) {
            return num.toFixed(num > 1000 ? 0 : 2) * 1;
        };

        service.getReadableCurrencyString =  function (amount) {
            if (!amount || isNaN(amount)) {
                return '0.00';
            } else if (amount < 100) {
                return amount.toFixed(2);
            } else {
                return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            }
        };

        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find#Polyfill
        if (!Array.prototype.find) {
            Object.defineProperty(Array.prototype, 'find', {
                enumerable: false,
                configurable: true,
                writable: true,
                value: function (predicate) {
                    if (this === null) {
                        throw new TypeError('Array.prototype.find called on null or undefined');
                    }
                    if (typeof predicate !== 'function') {
                        throw new TypeError('predicate must be a function');
                    }
                    var list = Object(this);
                    var length = list.length >>> 0;
                    var thisArg = arguments[1];
                    var value;

                    for (var i = 0; i < length; i++) {
                        if (i in list) {
                            value = list[i];
                            if (predicate.call(thisArg, value, i, list)) {
                                return value;
                            }
                        }
                    }
                    return undefined;
                }
            });
        }

        service.cmpVersion = function (a, b) {
            var i;
            var cmp;
            var len;
            var re = /(\.0)+[^\.]*$/;
            a = (a + '').replace(re, '').split('.');
            b = (b + '').replace(re, '').split('.');
            len = Math.min(a.length, b.length);
            for (i = 0; i < len; i++) {
                cmp = parseInt(a[i], 10) - parseInt(b[i], 10);
                if (cmp !== 0) {
                    return cmp;
                }
            }
            return a.length - b.length;
        };

        service.parseBoolean = function (str, def) {
            var type = typeof (str);
            if (type === 'undefined' && typeof (def) === 'boolean') {
                return def;
            }
            if (type === 'boolean') {
                return str;
            }
            return str === 'true';
        };

        service.orderBy = function (name, items) {
            return items.sort(function (a, b) {
                return a[name].localeCompare(b[name]);
            });
        };

        return service;
    }]
);
