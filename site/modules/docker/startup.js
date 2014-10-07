'use strict';
var config = require('easy-config');
var vasync = require('vasync');

var Docker = function execute(scope) {
    var Docker = scope.api('Docker');
    var server = scope.api('Server');
    var methods = Docker.getMethods();
    var methodsForAllHosts = ['containers', 'getInfo', 'images'];
    var part;

    function capitalize(str) {
        return str[0].toUpperCase() + str.substr(1);
    }

    function jsonStreamParser(stream) {
        stream = part + stream;
        var response = [], index, json, nextLine = 0;
        function parse(part) {
            try {
                return JSON.parse(part);
            } catch (e) {
                return undefined;
            }
        }

        function regexIndexOf(str, regex, startpos) {
            var indexOf = str.substring(startpos || 0).search(regex);
            return (indexOf >= 0) ? (indexOf + (startpos || 0)) : indexOf;
        }

        //noinspection JSLint
        while ((index = regexIndexOf(stream, /}\s*{/, nextLine)) > -1) {
            part = stream.slice(nextLine, index + 1);

            json = parse(part);
            if (json === undefined) {
                break;
            }

            response.push(json);
            nextLine = index + 1;
        }

        //last try
        part = stream.slice(nextLine);

        json = parse(part);
        if (json !== undefined) {
            response.push(json);
        }
        return response;
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
                                var data = call.data || {all: true};
                                client[method](call.data, function (err, response) {
                                    if (response && Array.isArray(response)) {
                                        response.forEach(function (container) {
                                            container.hostName = host.name;
                                            container.hostId = host.id;
                                            container.primaryIp = host.primaryIp;
                                            if (method === 'containers') {
                                                container.containers = container.Status.indexOf('Up') !== -1 ? 'running' : 'stopped';
                                            }
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


    server.onCall('DockerPull', function (call) {
        Docker.createClient(call, call.data.host, function (error, client) {
            if (error) {
                return call.done(error);
            }
            client.createImage(call.data.options, function (err, req) {
                if (err) {
                    return call.done(err);
                }
                part = '';
                req.on('result', function (error, res) {
                    if (error) {
                        return call.done(error);
                    }
                    res.on('data', function (data) {
                        data = data.toString();
                        data = jsonStreamParser(data);
                        data.forEach(function (chunk) {
                            call.update(null, chunk);
                        });
                    });
                    res.on('end', function () {
                        call.done(null);
                    });
                });
                req.end();
            });
        });
    });
};

if (!config.features || config.features.docker !== 'disabled') {
    module.exports = Docker;
}
