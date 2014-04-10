"use strict";

var config = require('easy-config');
var manta = require('manta');
var fs = require('fs');

module.exports = function execute(scope, register) {
    function createClient(call) {
        var sign = manta.privateKeySigner({
            key: fs.readFileSync(config.cloudapi.keyPath, 'utf8'),
            keyId: config.cloudapi.keyId,
            user: config.cloudapi.username
        });
        var user = call.req.session.userName;
        call.req.log.info({sessionToken: !!call.req.session.token, cloudToken: !!call.req.cloud._token}, 'Manta client');
        var headers = {
            'X-Auth-Token': call.req.session.token || call.req.cloud._token
        };
        if (config.manta.privateKey) {
            sign = manta.privateKeySigner({
                key: fs.readFileSync(config.manta.privateKey, 'utf8'),
                keyId: config.manta.keyId,
                user: config.manta.user
            });
            headers = {};
        }
        return manta.createClient({
            headers: headers,
            sign: sign,
            user: user,
            url: config.manta.url,
            insecure: true,
            rejectUnauthorized: false
        });
    }

    var api = {};

    api.createClient = createClient;

    register('MantaClient', api);
};