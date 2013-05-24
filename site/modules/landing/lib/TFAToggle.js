'use strict';

/**
 * toggle "useMoreSecurity" features
 *   - 15 min sessions
 *   - two-factor authentication
 *
 * stores the toggle in capi metadata
 */


var appKey = 'portal';
var key =    'useMoreSecurity';

var set = function (customerUuid, secretkey, callback) {

    if (!customerUuid) {
        if(callback) {
            setImmediate(function () {
                callback(new Error('Missing UUID'));
            });
        }
        return false;
    }

    if (secretkey) {
        var value = {secretkey: secretkey};
        capi.putMetadata(customerUuid, appKey, key, value, function(err) {
            if (callback) {
                callback(err, secretkey);
            }
        });
    } else {
        capi.deleteMetadata(customerUuid, appKey, key, function(err) {
            if (callback){
                callback(err, secretkey);
            }
        });
    }

};

var get = function (customerUuid, callback) {
    capi.getMetadata(customerUuid, appKey, key, function (err, res, headers) {
        var result = false;
        res = res === 'false' ? false : res;
        if (typeof res === 'object' && res.secretkey) {
            result = res.secretkey;
        } else if (typeof res === 'string') {
            result = res.indexOf('=') !== -1 ? res.split('=')[1] : result;
        }
        callback(null, result);
    });
};

module.exports = {
    set: set,
    get: get
};