'use strict';
var fs = require('fs');
var path = require('path');

var config = require('easy-config');
var MemoryStream = require('memorystream');

var fileman = function execute(scope) {
    var Manta = scope.api('MantaClient');
    var server = scope.api('Server');

    server.onCall('ls', function (call) {
        var client = Manta.createClient(call);
        client.ls(call.data.path, function (err, res) {
            if (err) {
                call.done(err);
                return;
            }
            var files = [];
            function onEntry(e) {
                files.push(e);
            }

            res.on('directory', onEntry);
            res.on('object', onEntry);
            res.once('error', call.error.bind(call));
            res.once('end', function () {
                files.forEach(function (file) {
                    file.path = file.name;
                });
                call.done(null, files);
            });
        });
    });
    server.onCall('rm', function (call) {
        var client = Manta.createClient(call);
        client.unlink(call.data.path, call.done.bind(call));
    });
    server.onCall('put', function (call) {
        var fileStream = new MemoryStream(call.data.fileBody);
        var client = Manta.createClient(call);
        client.put(call.data.path, fileStream, {}, call.done.bind(call));
    });
    server.onCall('get', function (call) {
        var client = Manta.createClient(call);
        client.get(call.data.path, call.done.bind(call));
    });
    server.onCall('info', function (call) {
        var client = Manta.createClient(call);
        client.info(call.data.path, call.done.bind(call));
    });
};

if (!config.features || config.features.fileman !== 'disabled') {
    module.exports = fileman;
}