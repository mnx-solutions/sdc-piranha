'use strict';

var config = require('easy-config');
var sdcClients = require('sdc-clients');
var capi = new sdcClients.CAPI(config.capishim);
var appKey = 'portal';

if (config.capishim && config.capishim.allowSelfSigned) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

var set = function (customerUuid, key, value, callback) {
    if (!customerUuid) {
        if (callback) {
            setImmediate(function () {
                callback(new Error('Missing UUID'));
            });
        }
        return false;
    }

    if (value) {
        if (typeof value !== 'object') {
            value = {value: value};
        }
        capi.putMetadata(customerUuid, appKey, key, value, function (err) {
            if (callback) {
                callback(err, value);
            }
        });
    } else {
        capi.deleteMetadata(customerUuid, appKey, key, function (err) {
            if (callback) {
                callback(err, value);
            }
        });
    }

};

var get = function (customerUuid, key, val, callback) {
    if (val instanceof Function) {
        callback = val;
        val = 'value';
    }
    capi.getMetadata(customerUuid, appKey, key, function (err, res) {
        if (res === 'false') {
            callback(null, false);
            return;
        }
        var result = false;
        if (typeof res === 'string') {
            result = res.indexOf('=') !== -1 ? res.split('=')[1] : result;
        } else if (typeof res === 'object' && res[val]) {
            result = res[val];
        }
        callback(null, result);
    });
};

var safeSet = function (customerUuid, key, val, callback) {
    var attempts = 5;
    var trySet = function () {
        attempts -= 1;
        if (attempts < 0) {
            callback('Cannot set key ' + key);
            return;
        }
        set(customerUuid, key, val, function (err) {
            if (err) {
                trySet();
                return;
            }
            get(customerUuid, key, function (err, getVal) {
                if (err) {
                    trySet();
                    return;
                }
                if (getVal === val) {
                    callback(null, val);
                    return;
                }
                trySet();
            });
        });
    };
    trySet();
};

module.exports = {
    set: set,
    get: get,
    safeSet: safeSet
};