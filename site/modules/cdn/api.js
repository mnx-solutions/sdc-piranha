"use strict";

var fastly = require('fastly');

module.exports = function execute(scope, register) {
    function createClient(call) {
        return fastly(call.data.key);
    }

    function createService(call, callback) {
        var client = createClient(call);
        client.request('POST', '/service', call.data, callback);
    }

    function createDomain(call, callback) {
        var client = createClient(call);
        var opts = {
            name: call.data.domain
        };
        client.request('POST', '/service/' + call.data.service_id + '/version/' + call.data.version + '/domain', opts, callback);
    }

    function createBackend(call, callback) {
        var client = createClient(call);
        var opts = {
            service: call.data.service_id,
            address: call.data.backend,
            name: 'Manta',
            port: 80
        };
        client.request('POST', '/service/' + call.data.service_id + '/version/' + call.data.version + '/backend', opts, callback);
    }

    var api = {};
    api.createBackend = createBackend;
    api.createService = createService;
    api.createDomain = createDomain;
    register('CdnClient', api);
};

