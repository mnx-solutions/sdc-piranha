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

var fs = require('fs');
var path = require('path');
var soap = require('soap');

var defaultMaxClientAge = 2 * 60 * 60 * 1000; // 2 hour

// client is cached and shared here
var client,
    config,
    clientCreatedAt = 0;

function parseArgs(args) {
    var a = Array.prototype.slice.call(args, 0);
    var r = {};
    if (typeof a[a.length - 1] === 'function') {
        r.callback = a.pop();
    }
    if (typeof a[0] === 'object') {
        r.config = a.pop();
    }
    if (typeof a[0] === 'object') {
        r.requestNewClient = a.pop();
    }
    return r;
}
/**
 * Connect: Creates a client
 * Overloaded function. It will create a new client, or use an existing one.
 *
 * @param {object} config (optional) Config object for SoapClient
 * @param {object} requestNewClient (optional) force creation of new client
 * @param {function} callback Fn called after connected
 */
function connect () {
    var args = parseArgs(arguments);
    var callback = args.callback;
    config = args.config || config;

    if (!config) {
        return callback(new Error('SOAP config is undefined'));
    }

    var maxClientAge = config.maxClientAge || defaultMaxClientAge;
    var clientExpired = (maxClientAge < Date.now() - clientCreatedAt);
    if (client && !clientExpired && !args.requestNewClient) {
        return callback(null, client);
    }

    var wsdl = path.resolve(__dirname, 'config', config.wsdl);
    soap.createClient(wsdl, function (err, newClient) {
    if (err) {
        return callback(err);
    }

    newClient.setEndpoint(config.endpoint);
    var loginCreds = {
        'zns:username': config.user,
        'zns:password': config.password
    };
    // TODO: dm: it may be possible for this to hang?
    newClient.ZuoraService.Soap.login(loginCreds, function (err, resp) {
        if (err) {
            return callback(err);
        }
        newClient.addSoapHeader({
            'zns:SessionHeader': {
                'zns:session': resp.result[0].Session
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
    if (typeof zObject === 'object') {
        if (zObject['zns:queryString'].indexOf('[object Object]') !== -1) {
            return callback(new Error('Query found [object Object] inside string.'));
        }
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
    query:     query
};
