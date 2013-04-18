'use strict';

var smartdc = require('smartdc');
var crypto = require('crypto');
var fs = require('fs');

var _tokenCloud = {};

/**
 * Wrapper for CloudAPI that allows changing of datacenter
 * @param opts
 * @returns {Cloud}
 * @constructor
 */
function Cloud(opts) {
    if(!(this instanceof Cloud)){
        return new Cloud(opts);
    }

    var self = this;
    Object.defineProperty(self, 'log', { value: opts.log });
    Object.defineProperty(self, '_token', { value: opts.token });

}


/**
 * Object that caches the datacenters and manages Cloud clients
 * @param opts
 * @returns {SmartCloud}
 * @constructor
 */
function SmartCloud(opts) {
    if(!(this instanceof SmartCloud)) {
        return new SmartCloud(opts);
    }

    var self = this;

    self.DATACENTERS_STALE_INTERVAL = opts.DATACENTERS_STALE_INTERVAL || (60 * 60 * 24 * 1000);

    self.datacenters = {};
    self._updated = null;
    self.log = opts.log;

    self._sign = self._getRequestSigner(opts);
    self._url = opts.api.url;
    self._cloudTimeout = opts.api.cloudTimeout || 60000;
}

/**
 * Create HTTP signature signer
 *
 * @param opts
 * @returns {Function}
 * @private
 */
SmartCloud.prototype._getRequestSigner = function (opts) {
    var data = fs.readFileSync(opts.api.keyPath); // Bad sync, but we are only calling it on startup.

    return function (date, callback) {
        var signer = crypto.createSign('RSA-SHA256');
        signer.update(date);

        var signedData = signer.sign(data.toString(), 'base64');

        setImmediate(function () {
            if (signedData) {
                callback(null, {
                    user: opts.api.username,
                    keyId: opts.api.keyId,
                    algorithm: 'RSA-SHA256',
                    signature: signedData
                });
            } else {
                callback(new Error('Can\'t sign request data'));
            }
        });
    };
};

function refreshTimeout(cloud, lifespan) {
    if(cloud._timeout) {
        clearTimeout(cloud._timeout);
    }
    cloud._timeout = setTimeout(function () {
        delete _tokenCloud[cloud.token];
    }, lifespan);
}

SmartCloud.prototype.cloud = function (opts, callback) {
    var self = this;

    if(_tokenCloud[opts.token]) {
        refreshTimeout(_tokenCloud[opts.token], self._cloudTimeout);
        return _tokenCloud[opts.token];
    }

    opts.log = self.log;

    var cloud = new Cloud(opts);
    var client = smartdc.createClient({
        url: self._url,
        sign: self._sign,
        token: cloud._token,
        logger: cloud.log,
        rejectUnauthorized: false
    });

    Object.defineProperty(cloud, '_client', {
        get: function() {
            return client;
        },
        set: function (v) {
            client = v;
        }
    });

    Object.defineProperty(cloud, '_currentDC', { value: self._url, writable: true});
    
    Object.defineProperty(cloud, 'setDatacenter', {
        value: function (url) {
            url = self.datacenters[url] || url;
            if(url !== this._currentDC) {
                cloud._client = smartdc.createClient({
                    url: url,
                    sign: self._sign,
                    token: cloud._token,
                    logger: cloud.log
                });
                this._currentDC = url;
            }
        }
    });

    var k;
    for(k in cloud._client) {
        (function(k) {
            cloud[k] = function(a1, a2, a3, a4, a5, a6, a7, a8) {
                return cloud._client[k](a1, a2, a3, a4, a5, a6, a7, a8);
            };
        }(k));
    }

    cloud.listDatacenters = function (callback) {
        if(callback) {
            setImmediate(function() {
                callback(null, self.datacenters);
            });
        }
        return self.datacenters;
    };

    if(self.needRefresh() && callback){
        cloud._client.listDatacenters(function (err, dcs) {
            if (err) {
                callback(err);
                return;
            }
            self.datacenters = dcs;
            self._updated = Date.now();
            callback(null, cloud);
        });
        return false;
    }
    _tokenCloud[opts.token] = cloud;
    refreshTimeout(cloud, self._cloudTimeout);
    return cloud;
};

SmartCloud.prototype.needRefresh = function () {
    return (!this.datacenters || this._updated < (Date.now() - this.DATACENTERS_STALE_INTERVAL));
};

module.exports = SmartCloud;
