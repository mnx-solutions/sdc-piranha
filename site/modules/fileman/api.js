"use strict";

var config = require('easy-config');
var manta = require('manta');
var fs = require('fs');

module.exports = function execute(scope, register) {
    function createClient(call, admin) {
        var cloud = call.req.cloud;
        var sign = cloud.sign.bind(cloud);
        var user = admin ? config.cloudapi.username : (config.manta.user || call.req.session.userName);
        var headers = {
            'x-auth-token': cloud._token
        };
        if (config.manta.privateKey) {
            sign = manta.privateKeySigner({
                key: fs.readFileSync(admin ? config.cloudapi.keyPath : config.manta.privateKey, 'utf8'),
                keyId: admin ? config.cloudapi.keyId : config.manta.keyId,
                user: user
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