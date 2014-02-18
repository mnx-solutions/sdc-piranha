'use strict';
var fs = require('fs');
var path = require('path');

var config = require('easy-config');
var MemoryStream = require('memorystream');

var fileman = function execute(scope) {
    var Manta = scope.api('MantaClient');
    var server = scope.api('Server');

    server.onCall('FileManGetUser', function (call) {
        //TODO: User specific cache of manta client
        var client = Manta.createClient(call);
        call.done(null, {user: client.user});
    });

    server.onCall('FileManList', function (call) {
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
    server.onCall('FileManRemove', function (call) {
        var client = Manta.createClient(call);
        client.unlink(call.data.path, call.done.bind(call));
    });
    server.onCall('FileManPut', function (call) {
        var fileStream = new MemoryStream(call.data.fileBody);
        var client = Manta.createClient(call);
        client.put(call.data.path, fileStream, {}, call.done.bind(call));
    });
    server.onCall('FileManGet', function (call) {
        var client = Manta.createClient(call);
        client.get(call.data.path, call.done.bind(call));
    });
    server.onCall('FileManInfo', function (call) {
        var client = Manta.createClient(call);
        client.info(call.data.path, call.done.bind(call));
    });
};

if (!config.features || config.features.fileman !== 'disabled') {
    module.exports = fileman;
}