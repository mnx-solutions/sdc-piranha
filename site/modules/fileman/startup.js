'use strict';
var fs = require('fs');
var path = require('path');

var config = require('easy-config');
var manta = require('manta');
var memoryStream = require('memorystream');
var fileman = function execute (scope) {
    
    function createClient(call, callback) {
        var client = manta.createClient({
            sign: manta.privateKeySigner({
                key: fs.readFileSync(config.manta.privateKey, 'utf8'),
                keyId: config.manta.keyId,
                user: config.manta.user || call.req.session.username
            }),
            user: config.manta.user || call.req.session.username,
            url: config.manta.url
        });
        
        callback(client);
    }
    
    var server = scope.api('Server');
    
    server.onCall('ls', function (call) {
        createClient(call, function (client) {
            console.log(call.data);
            client.ls(call.data.path, function (err, res) {
                var files = [];
                function onEntry(e) {
                    files.push(e);
                }

                res.on('directory', onEntry);
                res.on('object', onEntry);
                res.once('error', call.error.bind(call));
                res.once('end', function () {
                    files.forEach(function(file) {
                        file.path = file.name;
                    });
                    call.done(null, files);
                });
            });
        });
    });
    server.onCall('rm', function (call) {
        createClient(call, function(client) {
            client.unlink(call.data.path, call.done.bind(call));
        });
    });
    server.onCall('put', function(call) {
        var fileStream = new memoryStream(call.data.fileBody);
        createClient(call, function(client) {
            client.put(call.data.path, fileStream, {}, call.done.bind(call));
        });
    });
    server.onCall('get', function(call) {
        createClient(call, function(client) {
            client.get(call.data.path, call.done.bind(call));
        });
    });
    server.onCall('info', function(call) {
        createClient(call, function(client) {
            client.info(call.data.path, call.done.bind(call));
        });
    });
};

if (!config.features || config.features.fileman !== 'disabled') {
    module.exports = fileman;
}