'use strict';

var config = require('easy-config');
var sdcClients = require('sdc-clients');
var capi = new sdcClients.CAPI(config.capishim);

var appKey = 'portal';

var set = function (customerUuid, key, value, callback) {
    if (!customerUuid) {
        if(callback) {
            callback(new Error('Missing UUID'));
        }
        return false;
    }

    if (value) {
        capi.putMetadata(customerUuid, appKey, key, {value: value}, function(err) {
            if (callback) {
                callback(err, value);
            }
        });
    } else {
        capi.deleteMetadata(customerUuid, appKey, key, function(err) {
            if (callback){
                callback(err, value);
            }
        });
    }

};

var get = function (customerUuid, key, callback) {
    capi.getMetadata(customerUuid, appKey, key, function (err, res) {
        if(res === 'false') {
            callback(null, false);
            return;
        }
        var result = false;
        if(typeof res === 'string') {
            result = res.indexOf('=') !== -1 ? res.split('=')[1] : result;
        } else if(typeof res === 'object' && res.value) {
            result = res.value;
        }
        callback(null, result);
    });
};

module.exports = {
    set: set,
    get: get
};