"use strict";

var fastly = require('fastly');

module.exports = function execute(scope, register) {
    function createClient(call) {
        return fastly(call.data.key);
    }

    function request(call, method, url, params, callback) {
        var client = createClient(call);
        if (typeof params === 'function') {
            callback = params;
            params = null;
        }
        client.request(method, url, params, function (error, result) {
            if (error && error.message) {
                var message = JSON.parse(error.message);
                callback(message.msg + ' ' + message.detail);
            } else if (error && !error.message) {
                callback(error);
            } else {
                callback(null, JSON.parse(result));
            }
        });
    }

    function createService(call, callback) {
        request(call, 'POST', '/service', call.data, callback);
    }

    function createDomain(call, callback) {
        var opts = {
            name: call.data.domain
        };
        request(call, 'POST', '/service/' + call.data.service_id + '/version/' + call.data.version + '/domain', opts, callback);
    }

    function createBackend(call, callback) {
        var opts = {
            service: call.data.service_id,
            address: call.data.backend,
            name: 'Manta',
            port: 80
        };
        request(call, 'POST', '/service/' + call.data.service_id + '/version/' + call.data.version + '/backend', opts, callback);
    }

    function createHeader(call, callback) {
        var opts = {
            name: 'Manta Directory',
            type: 'request',
            action: 'set',
            dst: 'url',
            src: '"/' + call.req.session.userName + call.data.directory + '"',
            ignore_if_set: 0
        };
        request(call, 'POST', '/service/' + call.data.service_id + '/version/' + call.data.version + '/header', opts, callback);
    }

    function deleteService(call, callback) {
        request(call, 'DELETE', '/service/' + call.data.service_id, callback);
    }

    function listServices(call, callback) {
        request(call, 'GET', '/service', callback);
    }

    var api = {};
    api.listServices = listServices;
    api.deleteService = deleteService;
    api.createBackend = createBackend;
    api.createService = createService;
    api.createDomain = createDomain;
    api.createHeader = createHeader;
    register('CdnClient', api);
};

