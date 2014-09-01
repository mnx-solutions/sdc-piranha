"use strict";

var fastly = require('fastly');

module.exports = function execute(scope, register) {
    function createClient(call) {
        return fastly(call.data.key);
    }

    var constructUrl = function (type, data) {
        var result = '/service';
        if (type !== 'service') {
            result += '/' + data.service_id + '/version/' + data.version + '/' + type;
        }
        return result;
    };

    function request(call, method, url, params, callback) {
        var client = createClient(call);
        if (typeof (params) === 'function') {
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
                try {
                    result = JSON.parse(result);
                } catch (e) {
                    result = {};
                }
                callback(null, result);
            }
        });
    }

    function createService(call, callback) {
        request(call, 'POST', constructUrl('service'), call.data, callback);
    }

    function createDomain(call, callback) {
        var opts = {
            name: call.data.domain
        };
        request(call, 'POST', constructUrl('domain', call.data), opts, callback);
    }

    function createBackend(call, callback) {
        var opts = {
            service: call.data.service_id,
            address: call.data.backend,
            name: 'Manta',
            port: 80
        };
        request(call, 'POST', constructUrl('backend', call.data), opts, callback);
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
        request(call, 'POST', constructUrl('header', call.data), opts, callback);
    }

    function deleteService(call, callback) {
        request(call, 'DELETE', constructUrl('service') + '/' + call.data.service_id, callback);
    }

    function listServices(call, callback) {
        request(call, 'GET', constructUrl('service'), callback);
    }

    function domainStatus(call, callback) {
        request(call, 'GET', constructUrl('domain', call.data) + '/check_all', callback);
    }

    var api = {};
    api.listServices = listServices;
    api.domainStatus = domainStatus;
    api.deleteService = deleteService;
    api.createBackend = createBackend;
    api.createService = createService;
    api.createDomain = createDomain;
    api.createHeader = createHeader;
    register('CdnClient', api);
};

