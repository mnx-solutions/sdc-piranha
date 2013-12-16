'use strict';

var config = require('easy-config');
var path = require('path');
var soap = require('soap');

var MarketoSecurity = require('./marketo-security');
var MarketoObject = require('./marketo-object');

var defaultMaxClientAge = 2 * 60 * 60 * 1000; // 2 hour

// client is cached and shared here
var marketoConfig = config.marketo.soap;
var client;
var clientCreatedAt = 0;
var configError;

var errArr = [];
['secret', 'clientId','endpoint'].forEach(function (key) {
    if(!marketoConfig || !marketoConfig[key]) {
        errArr.push(key);
    }
});
if (errArr.length) {
    configError = 'config.marketo.soap[' + errArr.join(', ') + '] missing';
}

/**
 * Connect: Creates a client
 * Overloaded function. It will create a new client, or use an existing one.
 *
 * @param {object} config (optional) Config object for SoapClient
 * @param {function} callback Fn called after connected
 */
function connect (callback) {

    var maxClientAge = config.maxClientAge || defaultMaxClientAge;
    var clientExpired = (maxClientAge < Date.now() - clientCreatedAt);
    if (client && !clientExpired) {
        setImmediate(callback, null, client);
        return;
    }

    if (configError) {
        setImmediate(callback, new Error(configError));
        return;
    }

    var wsdl = path.resolve(__dirname, 'marketo.wsdl');
    soap.createClient(wsdl, function (err, newClient) {
        if (err) {
            return callback(err);
        }

        newClient.setEndpoint(marketoConfig.endpoint);
        newClient.setSecurity(new MarketoSecurity(marketoConfig.clientId, marketoConfig.secret));

        client = newClient;
        clientCreatedAt = Date.now();
        callback(null, client);
    });
}

function update(userId, object, callback) {
    connect(function (err, client) {
        if (err) {
            return callback(err);
        }

        var message = MarketoObject.syncLead(userId, object);
        client.syncLead(message, function (err, res) {
            if(err) {
                callback(err);
                return;
            }
            callback();
        });
    });
}

module.exports = {
    update: update
};
