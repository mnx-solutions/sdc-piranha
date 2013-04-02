'use strict';

var smartdc = require('smartdc');
var crypto = require('crypto');
var fs = require('fs');

/**
 * Create a new cloud instance
 *
 * @param opts
 * @param clients
 * @returns {Cloud}
 * @constructor
 */
function Cloud(opts, clients) {
    if (!(this instanceof Cloud)) {
        return new Cloud(opts, clients);
    }

    this._clients = clients;
    this._defaultClient = null;
    this._opts = opts;
    this._log = opts.log;
    this._updated = (Date.now() / 1000);

    // Find default client
    var self = this;
    Object.keys(this._clients).some(function (name) {
        var client = self._clients[name];
        if (client.options.url === opts.api.url) {
            self._defaultClient = client;
            return true;
        }

        return false;
    });
}

Cloud.DATACENTERS_STALE_INTERVAL = (60 * 60 * 24);

/**
 * Initialize a new cloud instance
 * Generate cloud map and return an instance
 *
 * @param opts
 * @param callback
 */
Cloud.init = function (opts, callback) {
    if (!opts.api) {
        callback(new Error('CloudAPI configuration is missing'));
        return;
    }

    Cloud._listDatacenters(opts, function(err, map) {
        if (err) {
            callback(err);
            return;
        }

        callback(null, new Cloud(opts, map));
    });
};

/**
 * Resolve and return CloudAPI instance
 *
 * opts:
 *  datacenter: datacenter id
 *
 * @param opts
 * @returns {Object}
 */
Cloud.prototype.proxy = function (opts) {
    this._log.debug('Resolve cloud %o', opts);

    if (opts && opts.hasOwnProperty('datacenter')) {
        if (this._clients.hasOwnProperty(opts.datacenter)) {
            this._log.debug('Found cloud %s', opts.datacenter);
            return this._clients[opts.datacenter];
        } else {
            this._log.debug('Fallbacking to the default client');
            return this._defaultClient;
        }
    } else {
        this._log.debug('Invalid opts, fallbacking to the default client');
        return this._defaultClient;
    }
};

/**
 * Return list of datacenters
 * Cached internally
 *
 * @param callback
 */
Cloud.prototype.listDatacenters = function (callback) {
    var self = this;
    var intervalDiff = (Date.now() / 1000) - this._updated;

    function createMap(clients) {
        var datacenters = {};

        Object.keys(clients).forEach(function (name) {
            var client = clients[name];
            datacenters[name] = client.options.url;
        });

        return datacenters;
    }

    this._log.debug('List datacenters');

    // Refresh cache
    if (intervalDiff >= Cloud.DATACENTERS_STALE_INTERVAL) {
        Cloud._listDatacenters(this._opts, function(err, clients) {
            if (err) {
                callback(err);
                return;
            }

            self._clients = clients;

            self._log.debug('Return a new list of clients %o', self._clients);
            callback(null, createMap(self._clients));
        });
    } else {
        this._log.debug('Return cached list of clients %o', this._clients);
        callback(null, createMap(this._clients));
    }
};

/**
 * Create datacenters mapping
 *
 * @param opts
 * @param callback
 * @private
 */
Cloud._listDatacenters = function (opts, callback) {
    var dcMap = {};
    var client = Cloud._createClient(
        opts.api.url,
        {
            api: opts.api,
            log: opts.log.child({
                datacenter: 'default'
            })
        }
    );

    if (!client) {
        callback(new Error('Client not created'));
        return;
    }

    client.listDatacenters(function (err, dcs) {
        if (err) {
            callback(err);
            return;
        }

        // Create clients
        Object.keys(dcs).forEach(function (name, index) {
            var url = dcs[name];
            var client = Cloud._createClient(
                url,
                {
                    api: opts.api,
                    log: opts.log.child({
                        datacenter: name
                    })
                }
            );

            dcMap[name] = client;
        });

        callback(null, dcMap);
    });
};

/**
 * Create a new CloudAPI client
 *
 * @param url
 * @param opts
 * @returns {Object}
 * @private
 */
Cloud._createClient = function (url, opts) {
    if (opts.api.keyId && opts.api.keyPath) {
        // if key is configured, use it.
        return smartdc.createClient({
            url: url,
            sign: Cloud._getRequestSigner(opts.api),
            logger: opts.log
        });
    }

    if (opts.api.username && opts.api.password) {
        // if username is in configuration, use it.
        return smartdc.createClient({
            url: url,
            username: opts.api.username,
            password: opts.api.password,
            logger: opts.log
        });
    }

    return null;
};

/**
 * Create HTTP signature signer
 *
 * @param opts
 * @returns {Function}
 * @private
 */
Cloud._getRequestSigner = function (opts) {
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
};

module.exports = Cloud;
