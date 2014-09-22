'use strict';
var config = require('easy-config');

var Docker = function execute(scope) {
    var Docker = scope.api('Docker');
    var server = scope.api('Server');
    var methods = Docker.getMethods();

    function capitalize(str) {
        return str[0].toUpperCase() + str.substr(1);
    }

    methods.forEach(function (method) {
        server.onCall('Docker' + capitalize(method), {
            verify: function (data) {
                return data && data.host && typeof (data.host.primaryIp) === 'string';
            },
            handler: function (call) {
                Docker.createClient(call, call.data.host, function (error, client) {
                    if (error) {
                        return call.done(error);
                    }
                    client[method](call.data.options, call.done.bind(call));
                });
            }
        });
    });

    server.onCall('DockerHosts', function (call) {
        Docker.listHosts(call, call.done.bind(call));
    });
};

if (!config.features || config.features.docker !== 'disabled') {
    module.exports = Docker;
}
