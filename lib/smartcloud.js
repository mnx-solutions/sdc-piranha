'use strict';

var smartdc = require('smartdc');
var crypto = require('crypto');
var fs = require('fs');
var url = require('url');
var http = require('http');
var https = require('https');
var config = require('easy-config');

var _tokenCloud = {};
var _tokenCount = {};
var agents = {};
var dataCenterIndependentFn = [
    'getAccount',
    'updateAccount',
    'createKey',
    'listKeys',
    'getKey',
    'deleteKey',
    'listDatacenters'
];

/**
 * Wrapper for CloudAPI that allows changing of datacenter
 * @param opts
 * @returns {Cloud}
 * @constructor
 */
function Cloud(opts) {
    if (!(this instanceof Cloud)){
        return new Cloud(opts);
    }

    var self = this;
    this._log = opts.log;
    this._token = opts.token;

    Object.defineProperty(this, 'log', { value: self._log });
    Object.defineProperty(this, '_token', { value: self._token });

    return this;
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

    self.REJECT_UNAUTHORIZED = opts.api.REJECT_UNAUTHORIZED;
    self.datacenterRefresh = opts.datacenterRefresh || (60 * 60 * 24 * 1000);

    self.datacenters = {};
    self._updated = null;
    self.log = opts.log;

    self._sign = self._getRequestSigner(opts);
    self._urls = opts.api.urls || [opts.api.url];
    self._main = 0;
    self._successMain = 0;
    self._cloudTimeout = opts.api.cloudTimeout || 60000;
    self._maxSimultaneous = opts.api.maxSimultaneous || 5;
    self._simultaneousTimeframe = opts.api.simultaneousTimeframe || 3000;
    self._DCCallTimeout = opts.api.DCCallTimeout || 10000;

    self._DCRotationTime = opts.api.cloudRotationTimeout || 5 * 60 * 1000;
    self._DCRotationTimeout = null;

    return this;
}

SmartCloud.prototype._updateDCRotationTimeout = function () {
    var self = this;
    if(self._DCRotationTimeout) {
        clearTimeout(self._DCRotationTimeout);
    }
    self._DCRotationTimeout = setTimeout(function () {
        self._main = self._successMain;
    }, self._DCRotationTime);
};

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

function refreshTimeout(cloud, lifespan, _simTime) {
    if(cloud._timeout) {
        clearTimeout(cloud._timeout);
    }
    cloud._timeout = setTimeout(function () {
        delete _tokenCloud[cloud.token];
    }, lifespan);

    if(cloud._simTimeout) {
        clearTimeout(cloud._simTimeout);
    }
    cloud._simTimeout = setTimeout(function () {
        _tokenCount[cloud.token] = 0;
    }, _simTime);
}

function getAgent(opts) {
    if(agents[opts.url]) {
        return agents[opts.url];
    }

    var urlOpts = url.parse(opts.url);
    var proto = urlOpts.protocol === 'https:' ? https : http;

    agents[opts.url] = new proto.Agent(opts);

    return agents[opts.url];
}

SmartCloud.prototype._getAgentOptions = function (token, url, log) {
    var options = {
        connectTimeout: 15000,
        retry: {
            maxTimeout: 10000,
            retries: 3
        },
        url: url,
        sign: this._sign,
        token: token,
	    logLevel: log.level(),
        version: config.cloudapi.version || null,
        rejectUnauthorized: false,
        noCache:false
    };

    Object.defineProperty(options, 'agent', { value: getAgent(options) });

    return options;
};

SmartCloud.prototype._setupLogger = function (client, log) {
    client.client.log.serializers.obj = log.serializers.obj;
};

SmartCloud.prototype.cloud = function (opts, noCache, callback) {
    var self = this;

    if(typeof noCache === 'function') {
        callback = noCache;
        noCache = false;
    }

    if(_tokenCloud[opts.token] && !callback && !noCache) {
        if(++_tokenCount[opts.token] < self._maxSimultaneous) { //If we have less than maximum simultaneous then return old
            refreshTimeout(_tokenCloud[opts.token], self._cloudTimeout, self._simultaneousTimeframe);
            return _tokenCloud[opts.token];
        }
    }

    if (!opts.log) {
      opts.log = self.log;
    }

    var cloud = new Cloud(opts);
    var options = self._getAgentOptions(opts.token, self._urls[self._main], opts.log);

    var client = smartdc.createClient(options);
    self._setupLogger(client, opts.log);

    Object.defineProperty(cloud, '_client', {
        get: function () {
            return client;
        },
        set: function (v) {
            client = v;
        }
    });

    Object.defineProperty(cloud, '_currentDC', { value: self._urls[self._main], writable: true});
    
    Object.defineProperty(cloud, 'setDatacenter', {
        value: function (url) {
            url = self.datacenters[url] || url;
            if (url && url !== this._currentDC) {
                if (/^https?:\/\//.test(url)) {
                    var options = self._getAgentOptions(opts.token, url, cloud.log);

                    cloud._client = smartdc.createClient(options);
                    self._setupLogger(cloud._client, cloud.log);
                    this._currentDC = url;
                }
                else {
                    cloud.log.error('Datacenter "' + url + '" not found.');
                }
            }
        }
    });

    Object.defineProperty(cloud, 'separate', {
        value: function (url) {
            var c = self.cloud(opts, true);
            if (url) {
                c.setDatacenter(url);
            }
            return c;
        }
    });

    function hasNextDC(cloud) {
        var increase = 1;
        var main = self._main;
        if(!self._urls[main + 1]) { // End of array
            main = 0;
            increase = 0;
        }
        // We have rotated to last point
        if((main + increase) === self._successMain) {
            return false;
        }
        return true;
    }

    function nextDC(cloud) {
        var increase = 1;
        if(!self._urls[self._main + 1]) { // End of array
            self._main = 0;
            increase = 0;
        }
        // We have rotated to last point
        if((self._main + increase) === self._successMain) {
            return false;
        }
        if(self._urls[self._main + increase] !== cloud._currentDC) {
            self._main = self._main + increase;
        }
        self._updateDCRotationTimeout();
        cloud.log.info('Switching to datacenter: %s', self._urls[self._main]);
        cloud.setDatacenter(self._urls[self._main]);

        return true;
    }

    function inheritDCIndependentFn(k) {

        cloud[k] = function (a1, a2, a3, a4, a5) {
            var start = Date.now();
            if (k === 'listDatacenters' && !a2) {
                if(a1) {
                    setImmediate(a1.bind(a1, null, self.datacenters));
                }
                return self.datacenters;
            }

            if (!noCache) {
                refreshTimeout(cloud, self._cloudTimeout, self._simultaneousTimeframe);
            }
            var input = [a1, a2, a3, a4, a5];
            var cb = null;
            var cbi = null;
            var currentIndex = 0;
            var timer = null;

            function makeCall(index) {
                if(timer) {
                    clearTimeout(timer);
                }

                input[cbi] = function errCatchDC(err, d1, d2, d3, d4) {
                    // Passed this point already
                    if(index < currentIndex) {
                        return;
                    }
                    if(timer) {
                        clearTimeout(timer);
                    }
                    if(err) {
                        cloud.log.warn('%s call failed to datacenter %s', k, cloud._currentDC, err);
                        var next = nextDC(cloud);
                        if(!next) { // No more DCs
                            cb(err, d1, d2, d3, d4);
                            return;
                        }
                        makeCall(currentIndex);
                        return;
                    }
                    // Success so call callback
                    self._successMain = self._main;
                    cb(err, d1, d2, d3, d4);
                };

                cloud._client[k](input[0], input[1], input[2], input[3], input[4]);
                timer = setTimeout(function () {
                    if (!hasNextDC(cloud)) {
                        cloud.log.error('Call %s timed out after %d ms', k, (Date.now() - start));
                        cb(new Error('Call timed out'));
                        cb = function () {};
                        return;
                    }
                    nextDC(cloud);
                    currentIndex++;
                    makeCall(currentIndex);
                }, self._DCCallTimeout);
            }

            // Look for callback
            input.some(function (el, i) {
                if (typeof el === 'function') {
                    cb = el;
                    cbi = i;
                    return true;
                }
                return false;
            });

            return makeCall(currentIndex);
        };
    }

    function inherit(k) {
        cloud[k] = function(a1, a2, a3, a4, a5) {
            if (!noCache) {
                refreshTimeout(cloud, self._cloudTimeout, self._simultaneousTimeframe);
            }
            return cloud._client[k](a1, a2, a3, a4, a5);
        };
    }

    var k;
    for(k in cloud._client) { // Export all cloud._client functions
        if(dataCenterIndependentFn.indexOf(k) === -1) {
            inherit(k);
        } else {
            inheritDCIndependentFn(k);
        }
    }

    if(self.needRefresh() && callback){
        cloud.listDatacenters(function (err, dcs) {
            if(err) {
                callback(err);
                return;
            }
            if(dcs[undefined]) {
                self.log.error('Undefined found from datacenter list', cloud._currentDC, dcs);
                delete dcs[undefined];
            }
            self.datacenters = dcs;
            self._updated = Date.now();
            callback(null, cloud);
        }, true);
        return false;
    }
    if(!noCache) {
        _tokenCloud[opts.token] = cloud;
        _tokenCount[opts.token] = 0;
        refreshTimeout(cloud, self._cloudTimeout, self._simultaneousTimeframe);
    }
    return cloud;
};

SmartCloud.prototype.needRefresh = function () {
    return (!this.datacenters || this._updated < (Date.now() - this.datacenterRefresh));
};

module.exports = SmartCloud;
