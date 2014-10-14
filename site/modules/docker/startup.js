'use strict';
var config = require('easy-config');
var vasync = require('vasync');
var util = require('util');
var restify = require('restify');
var dockerIndexClient = restify.createJsonClient({
    url: 'https://index.docker.io'
});

var Docker = function execute(scope) {
    var Docker = scope.api('Docker');
    var server = scope.api('Server');
    var methods = Docker.getMethods();
    var methodsForAllHosts = ['containers', 'getInfo', 'images'];
    var part;

    function DockerHostUnreachable(host) {
        this.message = 'Docker host "' + host + '" is unreachable.';
    }

    util.inherits(DockerHostUnreachable, Error);

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

    function waitClient(call, host, callback) {
        var callOpts = call.data || {};

        Docker.createClient(call, host, function (error, client) {
            if (callOpts.wait && host.id) {
                Docker.waitHost(call, host, function (status) {
                    call.update(null, {hostId: host.id, status: status});
                }, function (error) {
                    callback(error, client);
                });
            } else {
                callback(error, client);
            }
        });
    }

    methods.forEach(function (method) {
        server.onCall('Docker' + capitalize(method), {
            verify: function (data) {
                return data && data.host && typeof (data.host.primaryIp) === 'string';
            },
            handler: function (call) {
                waitClient(call, call.data.host, function (error, client) {
                    if (error) {
                        return call.done(error);
                    }
                    client.ping(function (error) {
                        if (error) {
                            return call.done(new DockerHostUnreachable(call.data.host.primaryIp).message, true);
                        }
                        client[method](call.data.options, call.done.bind(call));
                    });
                });
            }
        });

        if (methodsForAllHosts.indexOf(method) !== -1) {
            server.onCall('Docker' + capitalize(method) + 'All', function (call) {
                Docker.listHosts(call, function (error, hosts) {
                    if (error) {
                        return call.done(error);
                    }

                    vasync.forEachParallel({
                        inputs: hosts,
                        func: function (host, callback) {
                            waitClient(call, host, function (error, client) {
                                if (error) {
                                    return callback(error);
                                }
                                client.ping(function (error) {
                                    if (error) {
                                        return callback(new DockerHostUnreachable(host.primaryIp));
                                    }

                                    client[method](call.data.options, function (err, response) {
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
                            });
                        }
                    }, function (vasyncError, operations) {
                        if (vasyncError) {
                            var cause = vasyncError.jse_cause[0];
                            if (cause) {
                                return call.done(cause, cause instanceof DockerHostUnreachable);
                            }
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

    server.onCall('RegistryPing', {
        verify: function (data) {
            return data;
        },
        handler: function (call) {
            Docker.createRegistryClient(call, call.data, function (error, client) {
                if (error) {
                    return call.done(error);
                }
                client.ping(function (err, result) {
                    call.done(err, result);
                });
            });
        }
    });

    server.onCall('DockerGetRegistriesList', function (call) {
        var client = scope.api('MantaClient').createClient(call);
        client.getFileContents('~~/stor/.joyent/docker/registries.json', function (error, list) {
            if (error && error.statusCode !== 404) {
                return call.done(error.message, true);
            }
            if (error && error.statusCode === 404) {
                return call.done(null, []);
            }

            try {
                list = JSON.parse(list);
                list.forEach(function (regisry) {
                    if (regisry.auth) {
                        regisry.auth = null;
                    }
                });
            } catch (e) {
                call.log.warn('Registries list is corrupted');
                list = [];
            }
            call.done(null, list);
        });
    });

    server.onCall('DockerSaveRegistriesList', {
        verify: function (data) {
            return data && Array.isArray(data.options);
        },
        handler: function (call) {
            var client = scope.api('MantaClient').createClient(call);
            client.putFileContents('~~/stor/.joyent/docker/registries.json', JSON.stringify(call.data.options), function (error) {
                return call.done(error && error.message, true);
            });
        }
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

    server.onCall('DockerImageTags', {
        verify: function (data) {
            return data && data.options && typeof (data.options.name) === 'string';
        },
        handler: function (call) {
            var path = '/v1/repositories/' + call.data.options.name + '/tags';
            dockerIndexClient.get(path, function (err, req, res, data) {
                if (err) {
                    return call.done(err);
                }
                call.done(null, data);
            });
        }
    });
};

if (!config.features || config.features.docker !== 'disabled') {
    module.exports = Docker;
}
