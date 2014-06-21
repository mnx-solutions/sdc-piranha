"use strict";

var config = require('easy-config');
var manta = require('manta');
var fs = require('fs');
var MemoryStream = require('memorystream');

module.exports = function execute(scope, register) {
    function getFileContents(filepath, encoding, callback) {
        if (!callback) {
            callback = encoding;
        }
        this.get(filepath, function (error, stream) {
            if (error) {
                callback(error);
                return;
            }
            var data = '';
            stream.setEncoding('utf8');
            stream.on('data', function (chunk) {
                data += chunk;
            });
            stream.on('end', function () {
                callback(null, data);
            });
            stream.on('error', function (err) {
                callback(err);
            });
        });
    }
    function putFileContents(filepath, data, callback) {
        data = typeof data === 'string' ? data : JSON.stringify(data);
        var fileStream = new MemoryStream(data);
        this.put(filepath, fileStream, {size: data.length, mkdirp: true}, callback);
    }
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

        client.getFileContents = getFileContents;
        client.putFileContents = putFileContents;
        return client;
    }

    var api = {};

    api.createClient = createClient;

    register('MantaClient', api);
};