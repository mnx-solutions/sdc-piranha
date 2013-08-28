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

function getRequestSigner(opts) {
    return function(date, callback) {
        fs.readFile(opts.keyPath, function(err, data) {
            if (err) {
                callback(err);
                return;
            }

            var signer = crypto.createSign('RSA-SHA256');
            signer.update(date);

            var signedData = signer.sign(data.toString(), 'base64');

            if (signedData) {
                callback(null, {
                    user: opts.username,
                    keyId: opts.keyId,
                    algorithm: 'RSA-SHA256',
                    signature: signedData
                });
            } else {
                callback(new Error('Can\'t sign request data'));
            }
        });
    };
}

module.exports.clone = clone;
module.exports.extend = extend;
module.exports.firstSlash = firstSlash;
module.exports.checkPush = checkPush;
module.exports.getRequestSigner = getRequestSigner;