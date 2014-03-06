"use strict";

var config = require('easy-config');
var manta = require('manta');
var fs = require('fs');

module.exports = function execute(scope, register) {
    function createClient(call, admin) {
        var user = admin ? config.cloudapi.username : (config.manta.user || call.req.session.userName);
        return manta.createClient({
            headers: {
                'x-auth-token': call.cloud._token
            },
            sign: call.cloud.sign.bind(call.cloud),
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