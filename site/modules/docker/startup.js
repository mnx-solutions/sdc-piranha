'use strict';
var config = require('easy-config');
var vasync = require('vasync');
var util = require('util');
var restify = require('restify');
var tar = require('tar');
var os = require('os');
var fs = require('fs');
var fstream = require('tar/node_modules/fstream');
var ursa = require('ursa');
var uuid = require('../../static/vendor/uuid/uuid.js');
var registryDockerfile = fs.readFileSync(__dirname + '/data/registry-Dockerfile', 'utf-8');

var Docker = function execute(scope) {
    var Docker = scope.api('Docker');
    var server = scope.api('Server');
    var methods = Docker.getMethods();
    var methodsForAllHosts = ['containers', 'getInfo', 'images'];
    var registriesCache = {};

    function DockerHostUnreachable(host) {
        this.message = 'Docker host "' + host + '" is unreachable.';
    }

    util.inherits(DockerHostUnreachable, Error);

    function capitalize(str) {
        return str[0].toUpperCase() + str.substr(1);
    }

    function jsonStreamParser(res, eachCallback) {
        var accumulatedData = '';
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

        res.on('data', function (data) {
            var nextLine = 0;
            accumulatedData += data.toString();
            //noinspection JSLint
            var index;
            while ((index = regexIndexOf(accumulatedData, /(?:\}\s*\{|\}\s*$)/, nextLine)) !== -1) {
                var part = accumulatedData.slice(nextLine, index + 1);

                var json = parse(part.trim());
                if (json === undefined) {
                    break;
                }
                eachCallback(json);
                nextLine = index + 1;
            }
        });
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

    var getRegistries = function (call, client, callback) {
        if (typeof (client) === 'function') {
            callback = client;
            client = scope.api('MantaClient').createClient(call);
        }

        client.getFileContents('~~/stor/.joyent/docker/registries.json', function (error, list) {
            if (error && error.statusCode !== 404) {
                return call.done(error.message, true);
            }

            try {
                list = JSON.parse(list);
            } catch (e) {
                call.log.warn('Registries list is corrupted');
                list = [];
            }
            callback(error, list);
        });
    };

    var saveRegistries = function (call, data, client, callback) {
        if (typeof (client) === 'function') {
            callback = client;
            client = null;
        }
        callback = callback || call.done;
        client = client || scope.api('MantaClient').createClient(call);
        client.putFileContents('~~/stor/.joyent/docker/registries.json', JSON.stringify(data), function (error) {
            return callback(error && error.message, true);
        });
    };

    var deleteRegistry = function (call, key, value, callback) {
        getRegistries(call, function (error, list) {
            var id;
            list = list.filter(function (item) {
                var condition = key === 'host' ? item.host === value && parseInt(item.port, 10) === 5000 : item[key] === value;
                if (condition) {
                    id = item.id;
                }
                return !condition;
            });
            if (id) {
                delete registriesCache[id];
                return saveRegistries(call, list, callback);
            }
        });
    };

    var methodHandlers = {};
    methods.forEach(function (method) {
        methodHandlers[method] = function (call, callback) {

            waitClient(call, call.data.host, function (error, client) {
                if (error) {
                    return callback(error);
                }
                client.ping(function (error) {
                    if (error) {
                        return callback(new DockerHostUnreachable(call.data.host.primaryIp).message, true);
                    }
                    client[method](call.data.options, callback);
                });
            });
        };
    });

    var oldRemove = methodHandlers.remove;

    methodHandlers.remove = function (call, callback) {
        oldRemove(call, function (err, result) {
            if (err) {
                return callback(err);
            }
            var container = call.data.container;
            var ports = [];
            if (container.Ports.length) {
                ports = container.Ports.map(function (port) {
                    return port.PublicPort;
                });
            } else {
                var isPrivateRegistryName = container.Names.some(function (name) {
                    return name === '/private-registry';
                });
                ports = isPrivateRegistryName && container.Image.indexOf('private-registry') >= 0 ? [5000] : [];
            }
            var host = call.data.host.primaryIp;
            if (ports.length) {
                // delete registry
                return getRegistries(call, function (error, list) {
                    var matchingRegistryId;
                    list = list.filter(function (item) {
                        if (item.host.substr(item.host.indexOf('://') + 3) === host) {
                            var matchingPorts = ports.some(function (port) {
                                return port === parseInt(item.port, 10);
                            });
                            matchingRegistryId = matchingPorts ? item.id : null;
                            return !matchingPorts;
                        } else {
                            return true;
                        }
                    });
                    if (matchingRegistryId) {
                        delete registriesCache[matchingRegistryId];
                        return saveRegistries(call, list, function (errSave) {
                            if (errSave) {
                                call.log.warn(errSave);
                            }
                            callback(null, result);
                        });
                    }
                });
            } else {
                callback(null, result);
            }
        });
    };

    methods.forEach(function (method) {
        server.onCall('Docker' + capitalize(method), {
            verify: function (data) {
                return data && data.host && typeof (data.host.primaryIp) === 'string';
            },
            handler: function (call) {
                methodHandlers[method](call, call.done.bind(call));
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

                                    client[method](util._extend({}, call.data.options), function (err, response) {
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
                            var cause = vasyncError.jse_cause || vasyncError.ase_errors;
                            if (Array.isArray(cause)) {
                                cause = cause[0];
                            } else {
                                return call.done(vasyncError);
                            }
                            return call.done(cause, cause instanceof DockerHostUnreachable);
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
        var defaultRegistry = {
            id: 'default',
            api: 'v1',
            host: 'https://index.docker.io',
            port: '443',
            username: 'none'
        };
        getRegistries(call, function (error, list) {
            registriesCache['default'] = defaultRegistry;
            if (error && error.statusCode === 404) {
                return call.done(null, [defaultRegistry]);
            }

            var checkDefaultRegistry = false;
            list.forEach(function (registry) {
                registriesCache[registry.id] = util._extend({}, registry);
                if (registry.auth) {
                    registry.auth = null;
                }
                if (registry.id === 'default') {
                    checkDefaultRegistry = true;
                }
            });
            if (!checkDefaultRegistry) {
                list.push(defaultRegistry);
            }
            call.done(null, list);
        });
    });

    server.onCall('DockerSaveRegistry', {
        verify: function (data) {
            return data && data.registry && data.registry.id;
        },
        handler: function (call) {
            var savedRegistry = call.data.registry;
            getRegistries(call, function (error, list) {
                var edited;
                list = list.map(function (registry) {
                    if (savedRegistry.id === registry.id) {
                        registry = savedRegistry;
                        edited = true;
                    }
                    return registry;
                });

                if (!edited) {
                    list.push(savedRegistry);
                }
                registriesCache[savedRegistry.id] = savedRegistry;
                saveRegistries(call, list);
            });
        }
    });

    server.onCall('DockerDeleteRegistry', {
        verify: function (data) {
            return data && data.registry && data.registry.id;
        },
        handler: function (call) {
            var registry = call.data.registry;
            deleteRegistry(call, 'id', registry.id, function (err) {
                if (err) {
                    return call.done(err);
                }
                var host = registry.host;
                waitClient(call, {primaryIp: host.substr(host.indexOf('://') + 3)}, function (error, client) {
                    if (error) {
                        return call.done(error);
                    }
                    client.ping(function (errPing) {
                        if (errPing) {
                            return call.done(new DockerHostUnreachable(host).message, true);
                        }
                        client.containers({}, function (err, containers) {
                            if (err) {
                                return call.done(err);
                            }
                            var matchingContainers = containers.filter(function (container) {
                                return container.Ports.some(function (port) {
                                    return port.PublicPort === parseInt(registry.port, 10);
                                });
                            });
                            if (matchingContainers[0]) {
                                client.remove({id: matchingContainers[0].Id.substr(0, 12), v: true, force: true}, call.done.bind(call));
                            }
                        });
                    });
                });
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

                    jsonStreamParser(res, function (chunk) {
                        call.update(null, chunk);
                    });

                    res.on('end', function () {
                        call.done(null);
                    });
                    res.on('error', function (error) {
                        call.done(error);
                    });
                });
                req.end();
            });
        });
    });

    server.onCall('DockerImageTags', {
        verify: function (data) {
            return data && data.options && typeof (data.options.name) === 'string' && data.registry;
        },
        handler: function (call) {
            var registry = registriesCache[call.data.registry];
            if (!registry) {
                return call.done();
            }
            Docker.createRegistryClient(call, registry, function (error, client) {
                if (error) {
                    return call.done(error);
                }
                client.imageTags(call.data.options, function (err, result) {
                    call.done(err, result);
                });
            });
        }
    });

    server.onCall('DockerSearchImage', {
        verify: function (data) {
            return data && data.options && typeof (data.options.q) === 'string' && data.registry;
        },
        handler: function (call) {
            var registry = registriesCache[call.data.registry];
            if (!registry) {
                return call.done();
            }
            Docker.createRegistryClient(call, registry, function (error, client) {
                if (error) {
                    return call.done(error);
                }
                client.searchImage(call.data.options, function (err, result) {
                    call.done(err, result);
                });
            });
        }
    });

    server.onCall('DockerCreateRegistry', {
        verify: function (data) {
            return data && data.host && data.host.primaryIp;
        },
        handler: function (call) {
            var mantaClient = scope.api('MantaClient').createClient(call);
            var temp = os.tmpDir() + '/' + Math.random().toString(16).substr(2) + '/';
            var pipeline = [];

            pipeline.push(function getFingerprint(collector, callback) {
                mantaClient.getFileContents('~~/stor/.joyent/docker/private.key', function (error, privateKey) {
                    if (error) {
                        return callback(error);
                    }
                    var key = ursa.createPrivateKey(privateKey);
                    collector.fingerprint = key.toPublicSshFingerprint('hex').replace(/([a-f0-9]{2})/gi, '$1:').slice(0, -1);
                    callback();
                });
            });

            pipeline.push(function createClient(collector, callback) {
                Docker.createClient(call, call.data.host, function (error, client) {
                    collector.client = client;
                    callback(error);
                });
            });

            pipeline.push(function pullRegistryImage(collector, callback) {
                collector.client.createImage({fromImage: 'registry', tag: 'latest'}, function (err, req) {
                    if (err) {
                        return callback(err);
                    }
                    req.on('result', function (error, res) {
                        if (error) {
                            return callback(error);
                        }
                        res.on('end', callback);
                        res.on('data', function () {
                            // this event should exist
                        });
                        res.on('error', callback);
                    });
                    req.end();
                });
            });

            pipeline.push(function buildPrivateRegistryImage(collector, callback) {
                collector.client.buildImage({t: 'private-registry', nocache: true, rm: true}, function (err, req) {
                    if (err) {
                        return callback(err);
                    }
                    var fe = fstream.Reader({path: temp, dirname: '/'});
                    var tarPack = tar.Pack({ noProprietary: true, fromBase: true });
                    tarPack.on('end', function () {
                        req.end();
                    });
                    fe.pipe(tarPack).pipe(req);

                    req.on('result', function (error, res) {
                        if (error) {
                            return callback(error);
                        }

                        res.on('data', function () {
                            // this event should exist
                        });
                        res.on('error', callback);
                        res.on('end', callback);
                    });
                });
            });

            pipeline.push(function createPrivateRegistryContainer(collector, callback) {
                collector.client.create({
                    name: 'private-registry',
                    Image: 'private-registry:latest',
                    Env: [
                            'MANTA_KEY_ID=' + collector.fingerprint,
                        'MANTA_PRIVATE_KEY=/root/.ssh/user_id_rsa',
                            'MANTA_USER=' + mantaClient.user,
                        'SETTINGS_FLAVOR=dev',
                        'SEARCH_BACKEND=sqlalchemy',
                        'DOCKER_REGISTRY_CONFIG=/config.yml',
                        'REGISTRY_PORT=5000'
                    ],
                    Volumes: {
                        '/root/.ssh': {}
                    },
                    AttachStderr: true,
                    AttachStdin: true,
                    AttachStdout: true,
                    OpenStdin: true,
                    StdinOnce: true,
                    Tty: true
                }, function (error, registry) {
                    collector.registry = registry;
                    callback(error);
                });
            });

            pipeline.push(function startPrivateRegistryContainer(collector, callback) {
                collector.client.start({
                    id: collector.registry.Id,
                    Binds: ['/root/.ssh:/root/.ssh:ro'],
                    "PortBindings": {
                        "5000/tcp": [{ "HostIp": "127.0.0.1", "HostPort": "5000" }]
                    }
                }, callback);
            });

            fs.mkdirSync(temp);
            fs.writeFileSync(temp + 'Dockerfile', registryDockerfile);

            vasync.pipeline({
                funcs: pipeline,
                arg: {}
            }, function (error) {
                fs.unlinkSync(temp + 'Dockerfile');
                fs.rmdirSync(temp);
                var host = 'http://' + call.data.host.primaryIp;
                if (error) {
                    return deleteRegistry(call, 'host', host, function (err) {
                        return call.done(error);
                    });
                }
                getRegistries(call, mantaClient, function (error, list) {
                    var registry;
                    list = list.map(function (item) {
                        if (item.host === host) {
                            delete item.processing;
                            registry = item;
                        }
                        return item;
                    });
                    if (!registry || !registry.id) {
                        registry = {
                            id: uuid.v4(),
                            api: 'v1',
                            host: host,
                            port: '5000'
                        };
                        list.push(registry);
                    }
                    registriesCache[registry.id] = registry;
                    saveRegistries(call, list, mantaClient);
                });
            });
        }
    });
};

if (!config.features || config.features.docker !== 'disabled') {
    module.exports = Docker;
}
