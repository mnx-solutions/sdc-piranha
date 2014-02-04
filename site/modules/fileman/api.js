/**
 * User: Vladimir Bulyga <zero@ccxx.cc>
 * Project: piranha
 * Date: 31.01.14 13:12
 */
"use strict";

var config = require('easy-config');
var manta = require('manta');
var fs = require('fs');

module.exports = function execute(scope, register) {
    function createClient(call, admin) {
        var key = fs.readFileSync(admin ? config.cloudapi.keyPath : config.manta.privateKey, 'utf8');
        var keyId = admin ? config.cloudapi.keyId : config.manta.keyId;
        var user = admin ? config.cloudapi.username : (config.manta.user || call.req.session.userName);

        return manta.createClient({
            sign: manta.privateKeySigner({
                key: key,
                keyId: keyId,
                user: user
            }),
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