'use strict';

/**
 * toggle "useMoreSecurity" features
 *   - 15 min sessions
 *   - two-factor authentication
 *
 * stores the toggle in capi metadata
 */
var config = require('easy-config');
var sdcClients = require('sdc-clients');
var capi = new sdcClients.CAPI(config.capishim);

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
        if(res === 'false') {
            callback(null, false);
            return;
        }

        var result = false;
        if(typeof res === 'string') {
            result = res.indexOf('=') !== -1 ? res.split('=')[1] : result;
        } else if(typeof res === 'object' && res.secretkey) {
            result = res.secretkey;
        }
        callback(null, result);
    });
};

module.exports = {
    set: set,
    get: get
};