'use strict';

window.JP.main.service('util', ['$rootScope',
    function ($rootScope) {
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

        service.getReadableFileSize = function (bytes, base) {
            var result = {value: 0, measure: 'Byte'};
            if (bytes > 0) {
                var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
                base = base || 1024;
                var i = parseInt(Math.floor(Math.log(bytes) / Math.log(base)), 10);
                var places = i > 2 ? 2 : (i === 2 ? 1 : 0);
                result.value = (bytes / Math.pow(base, i)).toFixed(places);
                result.measure = sizes[i];
            }
            return result;
        };

        service.getReadableFileSizeString = function (bytes, base) {
            var size = service.getReadableFileSize(bytes, base);
            return size.value + ' ' + size.measure;
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

        service.idToUuid = function (id) {
            return id.substr(0, 8) + '-'
                + id.substr(8, 4) + '-'
                + id.substr(12, 4) + '-'
                + id.substr(16, 4) + '-'
                + id.substr(20, 12);
        };

        service.rewriteUrl = function (params) {
            var a = document.createElement('a');
            var isWS = params.isWS;
            delete params.isWS;
            angular.extend(a, params);
            if (isWS) {
                a.protocol = a.protocol === 'http:' ? 'ws:' : 'wss:';
                if ($rootScope.features.production === 'enabled') {
                    a.port = params.port || $rootScope.wsPort;
                }
            }
            return a;
        };

        service.getNr = function (el) {
            el = String(el).replace(/,/g, '');
            if (!el || isNaN(el)) {
                return false;
            }
            return Number(el);
        };

        service.flatten = function (input, isDeep, result) {
            if (!Array.isArray(input)) {
                return [input];
            }
            result = result || [];

            for (var index = 0, length = input.length; index < length; index++) {
                var value = input[index];
                if (Array.isArray(value)) {
                    if (isDeep) {
                        service.flatten(value, isDeep, result);
                    } else {
                        result = result.concat(value);
                    }
                } else {
                    result.push(value);
                }
            }
            return result;
        };

        service.unique = function (items) {
            return items.filter(function (item, index) {
                return items.indexOf(item) === index;
            });
        };

        service.isFormInvalid = function (form, field, errorType) {
            var result = false;
            var formField = form[field];
            if (formField) {
                if (form.submitted &&
                    formField.$invalid &&
                    formField.$error.required &&
                    errorType === 'required') {
                    result = true;
                } else if (formField.$dirty) {
                    result = Object.keys(formField.$error).some(function (key) {
                        return formField.$error[key] && (!errorType || key === errorType);
                    });
                }
            } else {
                result = form.$invalid;
            }
            return result;
        };

        service.objectToArray = function (obj) {
            return Object.keys(obj || {}).map(function (key) {
                return {
                    key: key,
                    value: obj[key]
                };
            })
        };

        return service;
    }]
);
