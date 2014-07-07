'use strict';

var fs = require('fs');
var crypto = require('crypto');
var util = require('util');

Object.keys(util).forEach(function (key) {
    module.exports[key] = util[key];
});

function clone(obj) {
    if (typeof obj !== 'object') {
        return obj;
    }

    var ret;
    if (util.isArray(obj)) {
        ret = [];
        obj.forEach(function (val) {
            ret.push(clone(val));
        });
        return ret;
    }

    ret = {};

    if (obj && obj !== null) {
        Object.keys(obj).forEach(function (key) {
            ret[key] = clone(obj[key]);
        });
    }

    return ret;
}

/**
 * A extends B
 *
 * util.inherits works only with objects derived from Object
 *
 * @return {Object} Extended object
 */
function extend(a, b, noClone) { // A extends B
    a = a || {};

    if (typeof a !== 'object') {
        return noClone ? b : clone(b);
    }

    if (typeof b !== 'object') {
        return b;
    }

    if (!noClone) {
        a = clone(a);
    }

    var bk = Object.keys(b);
    var i, c;
    for (i = 0, c = bk.length; i < c; i++) {
        var key = bk[i];
        if (!a.hasOwnProperty(key) ||
            (!(typeof b[key] === 'object' && b[key].length === undefined) && (typeof b[key] !== 'function'))) { // Simple types
            a[key] = b[key];
        } else { // Complex types
            a[key] = extend(a[key], b[key], noClone);
        }
    }
    return a;
}

function firstSlash(str) {
    if (str.charAt(0) !== '/') {
        str = '/' + str;
    }
    return str;
}

function checkPush(arr, item) {
    if (arr.indexOf(item) === -1) {
        arr.push(item);
    }
    return arr;
}

function cmpVersion(a, b) {
    var i, cmp, len, re = /(\.0)+[^\.]*$/;
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
}

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

module.exports.clone = clone;
module.exports.extend = extend;
module.exports.firstSlash = firstSlash;
module.exports.checkPush = checkPush;
module.exports.cmpVersion = cmpVersion;
