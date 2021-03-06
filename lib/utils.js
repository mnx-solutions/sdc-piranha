'use strict';

var fs = require('fs');
var crypto = require('crypto');
var util = require('util');
var path = require('path');
var transform = require('stream').Transform;

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

function resolveIfExists() {
    var filePath = path.resolve.apply(path, arguments);
    if (fs.existsSync(filePath)) {
        return filePath;
    }
}

function requireIfExists() {
    if (!arguments[0]) {
        return;
    }
    var filePath = path.resolve.apply(path, arguments);
    if (fs.existsSync(filePath)) {
        return require(filePath);
    }
}

function sync(iterator, done) {
    var stream = new transform({objectMode: true});
    stream._transform = function (data, enc, cb) {
        function callback(error, modified) {
            stream.push(modified || data);
            cb.apply(stream, arguments);
        }
        if (!iterator) {
            return callback();
        }
        iterator.call(this, data, callback);
    };

    if (typeof done === 'function') {
        stream.on('finish', done);
    }
    return stream;
}

function capitalize(str) {
    return str[0].toUpperCase() + str.substr(1);
}

function getVasyncData(vasyncErrors, operations, suppressErrors) {
    var error = vasyncErrors || null;
    var result = null;
    if (vasyncErrors) {
        var cause = vasyncErrors['jse_cause'] || vasyncErrors['ase_errors'];
        if (Array.isArray(cause)) {
            error = cause[0];
        } else if (cause && typeof cause === 'object') {
            error = cause;
        }
    } else if (operations) {
        result = operations && operations.successes && [].concat.apply([], operations.successes) || [];
        if (suppressErrors && suppressErrors.length) {
            result.push({suppressErrors: suppressErrors});
        }
    }
    return {error: error, result: result};
}

module.exports.clone = clone;
module.exports.extend = extend;
module.exports.firstSlash = firstSlash;
module.exports.checkPush = checkPush;
module.exports.cmpVersion = cmpVersion;
module.exports.resolveIfExists = resolveIfExists;
module.exports.requireIfExists = requireIfExists;
module.exports.sync = sync;
module.exports.capitalize = capitalize;
module.exports.getVasyncData = getVasyncData;
