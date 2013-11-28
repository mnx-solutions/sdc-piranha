'use strict';
/**
 *
 * Gets the basic zuora client setup
 * loads the wsdl and logs into the zuora endpoint
 *
 * assume the wsdl is in the directory '../config' relative to this file
 *
 * TODO LD: add the following actions:
 *   subscribe, generate, queryMore, getUserInfo, amend
 *
 * TODO DM: http 500 errors happen. We need to retry if we hit them!
 */

var path = require('path');
var soap = require('soap');
var url = require('url');

var defaultMaxClientAge = 2 * 60 * 60 * 1000; // 2 hour

// client is cached and shared here
var client;
var config;
var clientCreatedAt = 0;

function setConfig(newConfig) {
    config = newConfig;
}
/**
 * Connect: Creates a client
 * Overloaded function. It will create a new client, or use an existing one.
 *
 * @param {object} config (optional) Config object for SoapClient
 * @param {function} callback Fn called after connected
 */
function connect (newConfig, callback) {

    if (!callback) {
        callback = newConfig;
    } else {
        config = newConfig;
    }

    if (!config || typeof config !== 'object'
        || !callback || typeof callback !== 'function') {

        setImmediate(callback.bind(callback, new Error('Expected (config[object], callback[function]) as input')));
        return;
    }

    var maxClientAge = config.maxClientAge || defaultMaxClientAge;
    var clientExpired = (maxClientAge < Date.now() - clientCreatedAt);
    if (client && !clientExpired) {
        setImmediate(callback.bind(callback, null, client));
        return;
    }

    var wsdl = path.resolve(__dirname, 'config', 'zuora.wsdl');
    soap.createClient(wsdl, function (err, newClient) {
        if (err) {
            return callback(err);
        }
        var endpoint = config.endpoint;
        try {
            var parsed = url.parse(newClient.wsdl.services.ZuoraService.ports.Soap.location);
            endpoint += parsed.path;
        } catch (e) {
            callback(new Error('Invalid WSDL file. Expected to have services.ZuoraService.ports.Soap.location'));
            return;
        }

        newClient.setEndpoint(endpoint);
        var loginCreds = {
            username: config.user,
            password: config.password
        };
        // TODO: dm: it may be possible for this to hang?
        newClient.ZuoraService.Soap.login(loginCreds, function (err, resp) {
            if (err) {
                return callback(err);
            }

            newClient.addSoapHeader({
                SessionHeader: {
                    session: resp.result.Session
                }
            });

            client = newClient;
            clientCreatedAt = Date.now();
            callback(null, client);
        });
    });
}

// TODO: move statusCode checking into a function that gets called after each action
function checkResults(err, resp, body, callback) {
    if (err) {
        return callback(err);
    }
    if (resp && !resp.result) {
        err = new Error({
            message: 'HTTP statusCode: ' + resp.statusCode,
            body: body,
            statusCode: resp.statusCode,
            code: 'error'
        });
    }
    callback(err, resp.result);
}

/**
 *
 * BEWARE: malformed queries will not run the callback!
 * ie. [object Object] or if you misspell a fieldname
 * like using AccountName instead of Name
 *
 * TODO: put a setTimeout on this to ensure that callback happens if the query
 * is malformed?
 */
function query (zObject, callback) {

    // Safety checking:
    if (typeof zObject === 'object' && zObject.queryString.indexOf('[object Object]') !== -1) {
        setImmediate(callback.bind(callback, new Error('Query found [object Object] inside string.')));
        return ;
    }

    connect(function (err, client) {
        if (err) {
            return callback(err);
        }

        client.ZuoraService.Soap.query(zObject, function (err, resp, body) {
            checkResults(err, resp, body, callback);
        });
    });
}

module.exports = {
    connect:   connect,
    query:     query,
    setConfig: setConfig
};
