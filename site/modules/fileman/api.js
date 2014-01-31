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
    function createClient(call) {
        return manta.createClient({
            sign: manta.privateKeySigner({
                key: fs.readFileSync(config.manta.privateKey, 'utf8'),
                keyId: config.manta.keyId,
                user: config.manta.user || call.req.session.userName
            }),
            user: config.manta.user || call.req.session.userName,
            url: config.manta.url,
            insecure: true,
            rejectUnauthorized: false
        });
    }

    var api = {};

    api.createClient = createClient;

    register('MantaClient', api);
};