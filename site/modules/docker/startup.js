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
var url = require('url');
var uuid = require('../../static/vendor/uuid/uuid.js');
var registryDockerfile = fs.readFileSync(__dirname + '/data/registry-Dockerfile', 'utf-8');

var Docker = function execute(scope) {
    var Docker = scope.api('Docker');
    var server = scope.api('Server');
    var machine = scope.api('Machine');
    var methods = Docker.getMethods();
    var methodsForAllHosts = ['containers', 'getInfo', 'images'];
    var removedContainersCache = {};

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


    var REMOVED_LOGS_PATH = '~~/stor/.joyent/docker/removed-logs.json';

    var getRemovedContainersList = function (call, callback) {
        var client = scope.api('MantaClient').createClient(call);
        client.getFileContents(REMOVED_LOGS_PATH, function (error, list) {
            if (error && error.statusCode !== 404) {
                return callback(error, true);
            }

            try {
                list = JSON.parse(list);
            } catch (e) {
                call.log.warn('Removed docker containers list is corrupted');
                list = [];
            }
            callback(null, list);
        });
    };

    var saveRemovedContainersList = function (call, data, callback) {
        callback = callback || call.done;
        var client = scope.api('MantaClient').createClient(call);
        client.putFileContents(REMOVED_LOGS_PATH, JSON.stringify(data), function (error) {
            if (error && error.statusCode !== 404) {
                return callback(error.message, true);
            }
            return callback(null);
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

    function saveLogsToManta(call, logPath, logs, callback) {
        var mantaclient = scope.api('MantaClient').createClient(call);
        mantaclient.putFileContents(logPath, JSON.stringify(logs), function (error) {
            return callback(error && error.message, true);
        });
    }

    methodHandlers.remove = function (call, callback) {
        waitClient(call, call.data.host, function (error, client) {
            if (error) {
                return callback(error);
            }
            client.ping(function (error) {
                if (error) {
                    return callback(new DockerHostUnreachable(call.data.host.primaryIp).message, true);
                }

                return client.logs({id: call.data.container.Id, tail: 'all'}, function (err, response) {
                    if (err) {
                        return callback(err);
                    }
                    var logs = '';
                    if (response && response.length) {
                        logs = Docker.parseLogResponse(response);
                    }
                    var tomorrowDate = Docker.dateFormat(new Date(new Date().getTime() + 24 * 60 * 60 * 1000).setHours(0, 0, 0, 0));
                    var logPath = '~~/stor/.joyent/docker/logs/' + call.data.container.hostId + '/' + call.data.container.Id + '/' + tomorrowDate + '.log';
                    saveLogsToManta(call, logPath, logs, function (error) {
                        if (error) {
                            return call.done(error);
                        }
                        client.remove(call.data.options, function (error, result) {
                            if (error) {
                                return call.done(error);
                            }
                            getRemovedContainersList(call, function (error, removedContainers) {
                                if (error) {
                                    if (error.statusCode === 404) {
                                        removedContainers = [];
                                    } else {
                                        return callback(error.message, true);
                                    }
                                }
                                var removedContainer = {
                                    Id: call.data.container.Id,
                                    Image: call.data.container.Image,
                                    Names: call.data.container.Names,
                                    hostId: call.data.container.hostId,
                                    hostName: call.data.container.hostName
                                };
                                var hostId = call.data.container.hostId;
                                removedContainers.push(removedContainer);
                                if (Array.isArray(removedContainersCache[hostId])) {
                                    removedContainersCache[hostId] = removedContainersCache[hostId].concat(removedContainers);
                                } else {
                                    removedContainersCache[hostId] = removedContainers;
                                }
                                var duplicateRemovedContainers = {};
                                removedContainersCache[hostId] = removedContainersCache[hostId].filter(function (removedContainer) {
                                    return removedContainer.Id in duplicateRemovedContainers ? 0 : duplicateRemovedContainers[removedContainer.Id] = removedContainer.Id;
                                });
                                saveRemovedContainersList(call, removedContainersCache[hostId], function (error) {
                                    if (error) {
                                        return call.log.warn(error.message, true);
                                    }
                                    var container = call.data.container;
                                    var ports = [];
                                    if (container.Ports && container.Ports.length > 0) {
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
                                        return Docker.getRegistries(call, function (error, list) {
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
                                                delete Docker.registriesCache[matchingRegistryId];
                                                return Docker.saveRegistries(call, list, function (errSave) {
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
                            });
                        });
                    });
                });
            });
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
                    var suppressErrors = [];
                    vasync.forEachParallel({
                        inputs: hosts,
                        func: function (host, callback) {
                            Docker.getHostStatus(call, host.id, function (error, status) {
                                if (error || status !== 'completed') {
                                    return callback(null, []);
                                }
                                Docker.createClient(call, host, function (error, client) {
                                    if (error) {
                                        suppressErrors.push(error);
                                        return callback(null, []);
                                    }

                                    client.ping(function (error) {
                                        if (error) {
                                            suppressErrors.push(error);
                                            return callback(null, []);
                                        }
                                        client[method](util._extend({}, call.data.options), function (err, response) {
                                            if (err) {
                                                suppressErrors.push(err);
                                                return callback(null, []);
                                            }
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
                                            callback(null, response);
                                        });
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
                        if (suppressErrors.length) {
                            result.push({suppressErrors: suppressErrors});
                        }
                        call.done(null, result);
                    });
                });
            });
        }
    });

    server.onCall('DockerHosts', function (call) {
        Docker.listHosts(call, call.done.bind(call));
    });

    server.onCall('DockerCompletedHosts', function (call) {
        Docker.listHosts(call, function (error, hosts) {
            if (error) {
                return call.done(error);
            }
            vasync.forEachParallel({
                inputs: hosts,
                func: function (host, callback) {
                    Docker.getHostStatus(call, host.id, function (error, status) {
                        if (error || status !== 'completed') {
                            callback(null, []);
                        }
                        if (status === 'completed') {
                            callback(null, [host]);
                        }
                    });
                }
            }, function (vasyncErrors, operations) {
                if (vasyncErrors) {
                    return call.done(vasyncErrors);
                }
                var result = [].concat.apply([], operations.successes);
                call.done(null, result);
            });
        });
    });

    server.onCall('GetRemovedContainers', function (call) {
        getRemovedContainersList(call, function (error, removedContainers) {
            if (error) {
                return call.done(error.message, true);
            }
            call.done(null, removedContainers);
        });
    });

    server.onCall('RemoveDeletedContainerLogs', function (call) {
        var logs = call.data.logs;
        var client = scope.api('MantaClient').createClient(call);
        function getRemovedContainers(logs, callback) {
            vasync.forEachPipeline({
                func: function (removedContainerLog, callback) {
                    getRemovedContainersList(call, function (error, removedContainers) {
                        if (error) {
                            return callback(error.message, true);
                        }
                        var path = '~~/stor/.joyent/docker/logs/' + removedContainerLog.hostId + '/' + removedContainerLog.Id;
                        var countHostRemovedContainers = removedContainers.filter(function (removedContainer) {
                            return removedContainer.hostId === removedContainerLog.hostId;
                        }).length;
                        removedContainers = removedContainers.filter(function (removedContainer) {
                            return removedContainer.Id !== removedContainerLog.Id;
                        });
                        if (removedContainerLog.hostState === 'removed' && countHostRemovedContainers === 1) {
                            path = '~~/stor/.joyent/docker/logs/' + removedContainerLog.hostId;
                        }
                        client.rmr(path, function (error) {
                            if (error && error.statusCode !== 404) {
                                return callback(error.message, true);
                            }
                            saveRemovedContainersList(call, removedContainers, callback);
                        });
                    });
                },
                inputs: logs
            }, callback);
        }
        if (logs.length > 0) {
            getRemovedContainers(logs, function (error) {
                if (error) {
                    return call.done(error.message, true);
                }
                call.done();
            });
        } else {
            call.done();
        }
    });

    server.onCall('DockerDeleteMachine', {
        verify: function (data) {
            return typeof data === 'object' &&
                data.hasOwnProperty('uuid') && data.hasOwnProperty('datacenter');
        },

        handler: function(call) {
            var options = {
                uuid: call.data.uuid,
                datacenter: call.data.datacenter
            };
            var removedContainerList = [];
            var getHostContainers = function (call, callback) {
                Docker.createClient(call, call.data.host, function (error, client) {
                    if (error) {
                        return callback(error, [], client);
                    }
                    client.containers({all: true}, function (error, containers) {
                        if (error) {
                            return callback(error, [], client);
                        }
                        return callback(error, containers, client);
                    });
                });
            };
            getHostContainers(call, function (error, hostContainers, client) {
                if (error) {
                    call.log.warn({error: error.message || error}, 'Unable to retrieve host containers to persist logs');
                    hostContainers = [];
                }
                vasync.forEachParallel({
                    inputs: hostContainers,
                    func: function (hostContainer, callback) {
                        var removedContainer = {
                            Id: hostContainer.Id,
                            Image: hostContainer.Image,
                            Names: hostContainer.Names,
                            hostId: call.data.uuid,
                            hostName: call.data.host.hostName,
                            hostState: 'removed'
                        };
                        removedContainerList.push(removedContainer);
                        client.logs({id: hostContainer.Id, tail: 'all'}, function (err, response) {
                            if (err) {
                                return callback(err);
                            }
                            var logs = '';
                            if (response && response.length) {
                                logs = Docker.parseLogResponse(response);
                            }
                            var tomorrowDate = Docker.dateFormat(new Date(new Date().getTime() + 24 * 60 * 60 * 1000).setHours(0, 0, 0, 0));
                            var logPath = '~~/stor/.joyent/docker/logs/' + call.data.uuid + '/' + hostContainer.Id + '/' + tomorrowDate + '.log';
                            saveLogsToManta(call, logPath, logs, function (error) {
                                callback(error);
                            });
                        });
                    }
                }, function (vasyncError, operations) {
                    if (vasyncError) {
                        var cause = vasyncError.jse_cause || vasyncError.ase_errors || vasyncError;
                        call.log.warn({error: cause}, 'Error while persisting container logs');
                    }
                    machine.Delete(call, options, function (error) {
                        if (error) {
                            return call.done(error.message, true);
                        }
                        vasync.parallel({
                            'funcs': [
                                function updateRegistries(callback) {
                                    Docker.getRegistries(call, function (err, list) {
                                        if (err) {
                                            return callback(err);
                                        }
                                        var listLength = list.length;
                                        if (listLength) {
                                            list = list.filter(function (item) {
                                                return item.host.indexOf(call.data.host.primaryIp) === -1;
                                            });
                                            if (listLength !== list.length) {
                                                Docker.saveRegistries(call, list, function (err) {
                                                    callback(err);
                                                });
                                            } else {
                                                callback();
                                            }
                                        } else {
                                            callback();
                                        }
                                    });
                                },
                                function updateRemovedContainerList(callback) {
                                    getRemovedContainersList(call, function (error, removedContainers) {
                                        if (error) {
                                            if (error.statusCode === 404) {
                                                removedContainers = [];
                                            } else {
                                                return callback(error.message);
                                            }
                                        }
                                        if (removedContainers.length > 0) {
                                            removedContainers = removedContainers.map(function (removedContainer) {
                                                if (call.data.uuid === removedContainer.hostId) {
                                                    removedContainer.hostState = 'removed';
                                                }
                                                return removedContainer;
                                            });
                                        }
                                        removedContainerList = removedContainerList.concat(removedContainers);
                                        var hostId = call.data.uuid;
                                        if (Array.isArray(removedContainersCache[hostId])) {
                                            removedContainersCache[hostId] = removedContainersCache[hostId].concat(removedContainerList);
                                        } else {
                                            removedContainersCache[hostId] = removedContainerList;
                                        }
                                        var duplicateRemovedContainers = {};
                                        removedContainersCache[hostId] = removedContainersCache[hostId].filter(function (removedContainer) {
                                            return removedContainer.Id in duplicateRemovedContainers ? 0 : duplicateRemovedContainers[removedContainer.Id] = removedContainer.Id;
                                        });
                                        saveRemovedContainersList(call, removedContainersCache[hostId], function (error) {
                                            if (error) {
                                                return callback(error);
                                            }
                                            callback();
                                        });
                                    });
                                }
                            ]
                        }, function (err) {
                            if (err) {
                                var cause = err.jse_cause || err.ase_errors || err;
                                call.log.warn({error: cause}, 'Error while updating registries list');
                            }
                            call.done();
                        });
                    });
                });
            });
        }
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
            username: 'none',
            type: 'global'
        };
        Docker.getRegistries(call, function (error, list) {
            Docker.registriesCache['default'] = defaultRegistry;
            if (error && error.statusCode === 404) {
                return call.done(null, [defaultRegistry]);
            }

            var checkDefaultRegistry = false;
            list.forEach(function (registry) {
                Docker.registriesCache[registry.id] = util._extend({}, registry);
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
            if (savedRegistry.username && savedRegistry.password && savedRegistry.password.length > 0 && savedRegistry.email) {
                var auth = {
                    username: savedRegistry.username,
                    password: savedRegistry.password,
                    email: savedRegistry.email,
                    serveraddress: savedRegistry.host + '/' + savedRegistry.api + '/'
                };
                savedRegistry.auth = new Buffer(JSON.stringify(auth)).toString('base64');
            } else {
                savedRegistry.auth = new Buffer(JSON.stringify({auth: '', email: ''})).toString('base64');
            }

            delete savedRegistry.password;
            Docker.getRegistries(call, function (error, list) {
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
                Docker.registriesCache[savedRegistry.id] = savedRegistry;
                Docker.saveRegistries(call, list);
            });
        }
    });

    server.onCall('DockerDeleteRegistry', {
        verify: function (data) {
            return data && data.registry && data.registry.id;
        },
        handler: function (call) {
            var registry = call.data.registry;
            Docker.deleteRegistry(call, 'id', registry.id, function (err) {
                if (err) {
                    return call.done(err);
                }
                var host = url.parse(registry.host).hostname;
                if (registry.type === 'local') {
                    waitClient(call, {primaryIp: host}, function (error, client) {
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
                                var matchingContainer = containers.find(function (container) {
                                    return container.Ports.some(function (port) {
                                        return port.PublicPort === parseInt(registry.port, 10);
                                    });
                                });
                                if (matchingContainer) {
                                    client.remove({id: matchingContainer.Id, v: true, force: true}, function (error) {
                                        if (error) {
                                            return call.done(error, false);
                                        }
                                        client.removeImage({id: 'private-registry:latest', force: true}, call.done.bind(call));
                                    });
                                }
                            });
                        });
                    });
                } else {
                    call.done(null, 'OK');
                }
            });
        }
    });

    var pullImage = function (call, options, auth) {
        Docker.createClient(call, call.data.host, function (error, client) {
            if (error) {
                return call.done(error);
            }
            client.createImage(options, function (err, req) {
                if (err) {
                    return call.done(err);
                }
                if (auth) {
                    req.setHeader('X-Registry-Auth', auth);
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
    };

    server.onCall('DockerPull', {
        verify: function (data) {
            return data && data.host && data.host.primaryIp
                && data.options && data.options.fromImage;
        },
        handler: function (call) {
            var options = call.data.options;
            var registryId = options.registryId;
            if (!registryId || registryId === 'local') {
                return pullImage(call, options);
            }
            Docker.getRegistries(call, function (error, list) {
                if (error && registryId !== 'default') {
                    if (error.statusCode !== 404) {
                        return call.done(error.message || error);
                    }
                    return call.done('Please fill authentication information for the registry.');
                }

                var registryRecord = list.find(function (item) {
                    return item.id === registryId;
                });

                if (!registryRecord  && registryId !== 'default') {
                    return call.done('Registry not found.');
                }
                registryRecord = registryRecord || {};
                var auth = registryRecord.auth || new Buffer(JSON.stringify({auth: '', email: ''})).toString('base64');

                pullImage(call, options, auth);
            });
        }
    });

    function parseTag(tag) {
        var parts = /(?:([^:]+:\d+)\/)?((?:([^\/]+)\/)?([^:]+))(?::(.+$))?/.exec(tag);
        if (!parts) {
            return {};
        }

        return {
            tag: parts[5],
            name: parts[4],
            repository: parts[3] || '',
            fullname: parts[2],
            registry: parts[1]
        };
    }

    server.onCall('DockerUploadImage', {
        verify: function (data) {
            return data && data.host && data.host.primaryIp
                && data.options && data.options.image && data.options.image.Id && data.options.registry && data.options.name;
        },
        handler: function (call) {
            var image = call.data.options.image;
            var registry = call.data.options.registry;
            var name = call.data.options.name;
            var parsedTag = parseTag(name);
            var pipeline = [];
            var registryUrl = url.parse(registry.host).hostname + ':' + registry.port;
            var taggedName = registry.username + '/' + parsedTag.name;
            if (registryUrl !== 'index.docker.io:443') {
                registry.type = registry.type || 'local';
                registryUrl = registry.type === 'local' ? 'localhost:5000' : registryUrl;
                taggedName = registryUrl + '/' + parsedTag.fullname;
            }

            pipeline.push(function createClient(collector, callback) {
                Docker.createClient(call, call.data.host, function (error, client) {
                    collector.client = client;
                    callback(error);
                });
            });

            pipeline.push(function getRegistry(collector, callback) {
                if (registry.type === 'local') {
                    collector.registryAuth = new Buffer(JSON.stringify({auth: '', email: ''})).toString('base64');
                    return callback();
                }

                Docker.getRegistries(call, function (error, list) {
                    if (error) {
                        if (error.statusCode !== 404) {
                            return callback(error.message || error);
                        }
                        return callback('Please fill authentication information for the registry.');
                    }

                    var registryRecord = list.find(function (item) {
                        return item.id === registry.id;
                    });
                    if (!registryRecord) {
                        if (registry.type === 'global') {
                            return callback('Please fill authentication information for the registry.');
                        }
                        return callback('Registry not found!');
                    }
                    if (registryRecord.auth) {
                        collector.registryAuth = registryRecord.auth;
                    }

                    callback();
                });
            });

            pipeline.push(function addTag(collector, callback) {
                collector.client.tagImage({
                    name: image.Id,
                    repo: taggedName,
                    tag: (parsedTag.tag || 'latest')
                }, callback);
            });

            pipeline.push(function getImageSlices(collector, callback) {
                collector.client.historyImage({id: image.Id}, function (error, slices) {
                    collector.slices = slices;
                    callback(error);
                });
            });

            pipeline.push(function pushImage(collector, callback) {
                var images = {};
                var total = 0;
                var buffer = 0;
                collector.slices.forEach(function (slice) {
                    total += slice.Size;
                    images[slice.Id.substr(0, 12)] = slice;
                });
                var uploaded = total;
                collector.client.pushImage({
                    tag: parsedTag.tag || 'latest',
                    name: taggedName
                }, function (error, req) {
                    if (error) {
                        return callback(error);
                    }
                    if (collector.registryAuth) {
                        req.setHeader('X-Registry-Auth', collector.registryAuth);
                    }

                    req.on('result', function (error, res) {
                        if (error) {
                            return callback(error);
                        }
                        res.on('error', callback);
                        res.on('end', callback);
                        jsonStreamParser(res, function (chunk) {
                            var currentImage = images[chunk.id];
                            if (chunk.error) {
                                return call.update(chunk.error);
                            }
                            if (!chunk.id || !currentImage) {
                                return call.update(null, {status: chunk.status});
                            }

                            if (chunk.status === 'Image already pushed, skipping') {
                                uploaded -= currentImage.Size;
                            } else if (chunk.progressDetail) {
                                var progressDetail = chunk.progressDetail;
                                if (chunk.status === 'Pushing') {
                                    uploaded -= progressDetail.current || 0;
                                } else if (chunk.status === 'Buffering to disk') {
                                    buffer += progressDetail.current || 0;
                                }
                            }

                            var result = {
                                status: chunk.status,
                                total: total,
                                uploaded: total - uploaded,
                                percents: Math.floor((total - uploaded) * 100 / total),
                                buffer: buffer
                            };
                            call.update(null, result);
                        });
                    });
                    req.end();
                });
            });
            vasync.pipeline({
                funcs: pipeline,
                arg: {}
            }, function (error) {
                if (error) {
                    return call.done(error);
                }
                call.done(null, 'OK');
            });
        }
    });

    server.onCall('DockerForceRemoveImage', {
        verify: function (data) {
            return data && data.options && data.options.id && data.host && data.host.primaryIp;
        },
        handler: function (call) {
            Docker.createClient(call, call.data.host, function (error, client) {
                if (error) {
                    return call.done(error, true);
                }
                client.images(function (error, images) {
                    if (error) {
                        return call.done(error, true);
                    }
                    var image = images.find(function (image) {
                        return image.Id.substr(0, 12) === call.data.options.id.substr(0, 12);
                    });
                    if (!image) {
                        return call.done('Image "' + call.data.options.id + '" not found', true);
                    }
                    var tags = image.RepoTags || [image.Id];
                    var funcs = [];
                    tags.forEach(function () {
                        funcs.push(function (callback) {
                            client.removeImage({id: image.Id, force: true}, function (error) {
                                callback(error);
                            });
                        });
                    });
                    vasync.parallel({
                        funcs: funcs
                    }, call.done.bind(call));
                });
            });
        }
    });

    server.onCall('DockerImageTags', {
        verify: function (data) {
            return data && data.options && typeof (data.options.name) === 'string' && data.registry;
        },
        handler: function (call) {
            var registry = Docker.registriesCache[call.data.registry];
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
            if (call.data.registry === 'local') {
                Docker.searchPrivateImage(call, call.data.options.q, call.done.bind(call));
                return;
            }
            var registry = Docker.registriesCache[call.data.registry];
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
            var installConfig = config.docker || {};

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
                        'MANTA_SUBUSER=' + Docker.SUBUSER_REGISTRY_LOGIN,
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
            var tempDockerFile = registryDockerfile;
            tempDockerFile = tempDockerFile.replace('{{REGISTRY_VERSION}}', (installConfig.registryVersion ? ':' + installConfig.registryVersion : ':latest'));
            tempDockerFile = tempDockerFile.replace('{{REGISTRY_DRIVER_VERSION}}', (installConfig.registryDriverVersion ? '==' + installConfig.registryDriverVersion : ''));
            fs.writeFileSync(temp + 'Dockerfile', tempDockerFile);

            vasync.pipeline({
                funcs: pipeline,
                arg: {}
            }, function (error) {
                fs.unlinkSync(temp + 'Dockerfile');
                fs.rmdirSync(temp);
                var host = 'https://' + call.data.host.primaryIp;
                if (error) {
                    return Docker.deleteRegistry(call, 'host', host, function (err) {
                        return call.done(error);
                    });
                }
                Docker.getRegistries(call, mantaClient, function (error, list) {
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
                            port: '5000',
                            type: 'local'
                        };
                        list.push(registry);
                    }
                    Docker.registriesCache[registry.id] = registry;
                    Docker.saveRegistries(call, list, mantaClient);
                });
            });
        }
    });
};

if (!config.features || config.features.docker !== 'disabled') {
    module.exports = Docker;
}
