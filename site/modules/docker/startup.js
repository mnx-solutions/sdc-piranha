'use strict';
var config = require('easy-config');
var vasync = require('vasync');

var Docker = function execute(scope) {
    var Docker = scope.api('Docker');
    var server = scope.api('Server');
    var methods = Docker.getMethods();
    var methodsForAllHosts = ['containers', 'getInfo'];

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

        if (methodsForAllHosts.indexOf(method) !== -1) {
            server.onCall('Docker' + capitalize(method) + 'All', function (call) {
                Docker.listHosts(call, function (error, hosts) {
                    vasync.forEachParallel({
                        inputs: hosts,
                        func: function (host, callback) {
                            Docker.createClient(call, host, function (error, client) {
                                if (error) {
                                    return callback(error);
                                }
                                client[method]({all: true}, function (err, response) {
                                    if (response && method === 'containers' && Array.isArray(response)) {
                                        response.forEach(function (container) {
                                            container.hostName = host.name;
                                            container.hostId = host.id;
                                            container.primaryIp = host.primaryIp;
                                            container.containers = container.Status.indexOf('Up') !== -1 ? 'running' : 'stopped';
                                        });
                                    }
                                    callback(err, response);
                                });
                            });
                        }
                    }, function (errors, operations) {
                        if (errors) {
                            return call.done(errors);
                        }
                        var result = [].concat.apply([], operations.successes);

                        call.done(null, result);
                    });
                });
            });
        }
    });

    server.onCall('DockerHosts', function (call) {
        Docker.listHosts(call, call.done.bind(call));
    });

    server.onCall('listContainers', function (call) {
        Docker.listHosts(call, function (err, hosts) {
            vasync.forEachParallel({
                inputs: hosts,
                func: function (host, callback) {
                    if (!host.primaryIp) {
                        return callback(null, []);
                    }
                    Docker.createClient(call, host, function (error, client) {
                        if (error) {
                            return callback(error);
                        }
                        client.containers({all: true}, function (error, containers) {
                            if (error) {
                                return callback(error);
                            }
                            containers.forEach(function (container) {
                                container.hostName = host.name;
                                container.hostId = host.id;
                            });
                            callback(null, containers);
                        });
                    });
                }
            }, function (errors, operations) {
                var containers = [].concat.apply([], operations.successes);
                call.done(null, containers);
            })
        });
    });
};

if (!config.features || config.features.docker !== 'disabled') {
    module.exports = Docker;
}
