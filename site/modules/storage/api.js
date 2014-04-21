"use strict";

var config = require('easy-config');
var manta = require('manta');
var fs = require('fs');

module.exports = function execute(scope, register) {
    function createClient(call) {

        var client = manta.createClient({
            sign: manta.privateKeySigner({
                key: fs.readFileSync(config.cloudapi.keyPath, 'utf8'),
                keyId: config.cloudapi.keyId,
                user: config.cloudapi.username
            }),
            user: call.req.session.userName,
            url: config.manta.url,
            insecure: true,
            rejectUnauthorized: false
        });

        if (config.manta.privateKey) {
            client.sign = manta.privateKeySigner({
                key: fs.readFileSync(config.manta.privateKey, 'utf8'),
                keyId: config.manta.keyId,
                user: config.manta.user
            });
        } else {
            client.client.headers['X-Auth-Token'] = call.req.session.token || call.req.cloud._token;
        }

        return client;
    }

    var api = {};

    api.createClient = createClient;

    register('MantaClient', api);
};