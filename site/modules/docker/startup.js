'use strict';
var config = require('easy-config');
var path = require('path');
var vasync = require('vasync');
var util = require('util');
var os = require('os');
var fs = require('fs');
var ursa = require('ursa');
var url = require('url');
var uuid = require('../../static/vendor/uuid/uuid.js');
var registryConfig = fs.readFileSync(__dirname + '/data/registry-config.yml', 'utf-8');
var Auditor = require(__dirname + '/libs/auditor.js');
var WebSocket = require('ws');

var DOCKER_TCP_PORT = 4240;
var DOCKER_HUB_HOST = 'https://index.docker.io';

var Docker = function execute(scope, app) {
    var Docker = scope.api('Docker');
    var server = scope.api('Server');
    var machine = scope.api('Machine');
    var httpServer = scope.get('httpServer');

    var methods = Docker.getMethods();
    var methodsForAllHosts = ['containers', 'getInfo', 'images'];
    var removedContainersCache = {};

    function capitalize(str) {
        return str[0].toUpperCase() + str.substr(1);
    }

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
            if (callOpts.wait && host.id && !callOpts.isSdc) {
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

    function putToAudit(call, entry, params, error, finish) {
        var mantaClient = scope.api('MantaClient').createClient(call);
        var auditor = new Auditor(call, mantaClient);
        if (error) {
            params.error = true;
            params.errorMessage = error.message || error;
        }
        auditor.put(entry, params);
        if (finish) {
            call.done(error);
        }
    }

    var REMOVED_LOGS_PATH = '~~/stor/.joyent/docker/removed-logs.json';

    var getRemovedContainersList = function (call, callback) {
        var client = scope.api('MantaClient').createClient(call);
        client.getFileJson(REMOVED_LOGS_PATH, function (error, list) {
            if (error) {
                call.log.warn('Removed docker containers list is corrupted');
                return callback(error, list);
            }
            callback(null, list);
        });
    };

    var saveRemovedContainersList = function (call, data, callback) {
        callback = callback || call.done;
        var client = scope.api('MantaClient').createClient(call);
        client.safePutFileContents(REMOVED_LOGS_PATH, JSON.stringify(data), function (error) {
            if (error && error.statusCode !== 404) {
                return callback(error.message, true);
            }
            removedContainersCache = {};
            return callback(null);
        });
    };

    var methodHandlers = {};
    methods.forEach(function (method) {
        methodHandlers[method] = function (call, callback) {

            waitClient(call, call.data.host, function (error, client) {
                if (error) {
                    return callback(error, call.data.suppressErrors);
                }
                client.ping(function (error) {
                    if (error) {
                        return callback(new Docker.DockerHostUnreachable(call.data.host).message, true);
                    }
                    client[method](call.data.options, function (error) {
                        if (error === 'CAdvisor unavailable') {
                            callback(error, true);
                            return;
                        }
                        callback.apply(this, arguments);
                    });
                });
            });
        };
    });

    function saveLogsToManta(call, logPath, logs, callback) {
        var mantaclient = scope.api('MantaClient').createClient(call);
        mantaclient.safePutFileContents(logPath, JSON.stringify(logs), function (error) {
            return callback(error && error.message, true);
        });
    }

    function removeContainer(call, client, container, options, callback) {
        if (typeof (options) === 'function') {
            callback = options;
            options = null;
        }
        options = options || {id: container.Id, v: true, force: true};
        return client.logs({id: container.Id, tail: 'all'}, function (err, response) {
            if (err) {
                return callback(err);
            }
            var logs = '';
            if (response && response.length) {
                logs = Docker.parseLogResponse(response);
            }
            var tomorrowDate = Docker.dateFormat(new Date(new Date().getTime() + 24 * 60 * 60 * 1000).setHours(0, 0, 0, 0));
            var logPath = '~~/stor/.joyent/docker/logs/' + container.hostId + '/' + container.Id + '/' + tomorrowDate + '.log';

            saveLogsToManta(call, logPath, logs, function (error) {
                if (error) {
                    return callback(error);
                }

                client.remove(options, function (error) {
                    if (error && error.indexOf('devicemapper failed to remove root filesystem') === -1) {
                        return callback(error);
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
                            Id: container.Id,
                            Image: container.Image,
                            Names: container.Names,
                            hostId: container.hostId,
                            hostName: container.hostName,
                            Deleted: new Date()
                        };
                        var hostId = container.hostId;
                        removedContainers.push(removedContainer);
                        if (Array.isArray(removedContainersCache[hostId])) {
                            removedContainersCache[hostId] = removedContainers.concat(removedContainersCache[hostId]);
                        } else {
                            removedContainersCache[hostId] = removedContainers;
                        }
                        var duplicateRemovedContainers = {};
                        removedContainersCache[hostId] = removedContainersCache[hostId].filter(function (removedContainer) {
                            return removedContainer.Id in duplicateRemovedContainers ? 0 : duplicateRemovedContainers[removedContainer.Id] = removedContainer.Id;
                        });
                        return saveRemovedContainersList(call, removedContainersCache[hostId], callback);
                    });
                });
            });
        });
    }

    methodHandlers.remove = function (call, callback) {
        var data = call.data;
        var hostObj = data.host;
        waitClient(call, hostObj, function (error, client) {
            if (error) {
                return callback(error);
            }
            client.ping(function (error) {
                var host = hostObj.primaryIp;
                if (error) {
                    return callback(new Docker.DockerHostUnreachable(host).message, true);
                }
                var container = data.container;
                return removeContainer(call, client, container, data.options, function (err) {
                    if (err) {
                        return call.log.warn(err.message, true);
                    }
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
                    if (ports.length) {
                        // delete registry
                        return Docker.getRegistries(call, function (error, list) {
                            var matchingRegistryId;
                            list = list.filter(function (item) {
                                if (url.parse(item.host).hostname === host) {
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
                                    callback(null, {});
                                });
                            } else {
                                callback(null, {});
                            }
                        });
                    } else {
                        callback(null, {});
                    }
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
                            var cause = vasyncError['jse_cause'] || vasyncError['ase_errors'];
                            if (Array.isArray(cause)) {
                                cause = cause[0];
                            } else {
                                return call.done(vasyncError);
                            }
                            return call.done(cause, cause instanceof Docker.DockerHostUnreachable);
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

    server.onCall('DockerPingHosts', function (call) {
        Docker.listHosts(call, function (error, hosts) {
            if (error) {
                return call.done(error);
            }
            vasync.forEachParallel({
                inputs: hosts,
                func: function (host, callback) {
                    Docker.createClient(call, host, function (error, client) {
                        if (error) {
                            return callback(error);
                        }
                        client.ping(function (err) {
                            callback(err);
                        });
                    });
                }
            }, function (vasyncError) {
                call.done(vasyncError);
            });
        });
    });

    server.onCall('DockerListHosts', function (call) {
        Docker.listHosts(call, function (error, hosts) {
            call.done(error, hosts);
        });
    });

    server.onCall('DockerCompletedHosts', function (call) {
        var getVersion = call.data && call.data.version;
        Docker.listHosts(call, function (error, hosts) {
            if (error) {
                return call.done(error);
            }
            if (hosts.length === 0) {
                return call.done(null, []);
            }
            vasync.forEachParallel({
                inputs: hosts,
                func: function (host, callback) {
                    Docker.getHostStatus(call, host.id, function (error, status) {
                        if (error || status !== 'completed') {
                            callback(null, []);
                        }
                        if (status === 'completed') {
                            if (getVersion) {
                                Docker.createClient(call, host, function (error, client) {
                                    if (error) {
                                        return callback(null, []);
                                    }
                                    client.getVersion(function (error, version) {
                                        host.dockerVersion = version;
                                        callback(error, [host]);
                                    });
                                });
                                return;
                            }
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

    server.onCall('DockerRun', {
        verify: function (data) {
            return data && data.host && data.options && data.options.create && data.options.create.Image && data.options.start;
        },
        handler: function (call) {
            var host = call.data.host;
            var options = call.data.options;
            var createOptions = options.create;
            var startOptions = options.start;
            var pipeline = [];

            var mantaClient = scope.api('MantaClient').createClient(call);
            var auditor = new Auditor(call, mantaClient);

            pipeline.push(function createClient(collector, callback) {
                Docker.createClient(call, host, function (error, client) {
                    collector.client = client;
                    callback(error);
                });
            });

            pipeline.push(function ping(collector, callback) {
                collector.client.ping(function (error) {
                    if (error) {
                        return callback(new Docker.DockerHostUnreachable(call.data.host).message, true);
                    }
                    callback();
                });
            });

            pipeline.push(function listImages(collector, callback) {
                collector.client.images({}, function(error, images) {
                    collector.hostImages = images || [];
                    callback(error);
                });
            });

            pipeline.push(function necessaryPullImage(collector, callback) {
                var isExistImage = collector.hostImages.some(function(image) {
                    return image.RepoTags.some(function(tag) {
                        return createOptions.Image === tag;
                    });
                });
                if (isExistImage) {
                    return callback();
                }
                var image = parseTag(options.create.Image);
                collector.client.pullImage({fromImage: image.name, tag: image.tag, registry: image.registry, repo: image.repository}, function(error) {
                    callback(error);
                });
            });

            pipeline.push(function createContainer(collector, callback) {
                collector.client.create(createOptions, function(error, response) {
                    if (response && response.Id) {
                        startOptions.id = response.Id;
                    }
                    callback(error);
                });
            });

            pipeline.push(function startContainer(collector, callback) {
                collector.client.startImmediate(util._extend({}, startOptions), function (error) {
                    callback(error);
                });
            });

            pipeline.push(function setAudit(collector, callback) {
                var entry = startOptions.id;
                delete startOptions.id;
                auditor.put({
                    host: host.id,
                    entry: entry,
                    type: 'container',
                    name: 'run'
                }, options);
                callback();
            });

            vasync.pipeline({
                funcs: pipeline,
                arg: {}
            }, function (error) {
                if (error) {
                    auditor.put({
                        host: host.id,
                        entry: startOptions.id,
                        type: startOptions.id ? 'container' : 'docker',
                        name: 'run'
                    }, util._extend(options, {error: true, errorMessage: error.message || error}));
                }
                call.done(error);
            });
        }
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

    server.onCall('DockerAnalyzeLogs', {
        verify: function (data) {
            return typeof data === 'object' &&
                data.hasOwnProperty('logs') && data.hasOwnProperty('dates');
        },
        handler: function (call) {
            var client = scope.api('MantaClient').createClient(call);
            var logs = call.data.logs;
            var startDate = call.data.dates.start;
            var endDate = call.data.dates.end + 86400;

            function getFilesInDateRange(logs, startDate, endDate) {
                vasync.forEachParallel({
                    inputs: logs,
                    func: function (log, callback) {
                        var analyzeLogFiles = [];
                        var logPath = '~~/stor/.joyent/docker/logs/' + log.hostId + '/' + log.Id;
                        client.ftw(logPath, function (err, entriesStream) {
                            if (err) {
                                if (err.statusCode === 404) {
                                    return callback(null, []);
                                }
                                return callback(err);
                            }

                            entriesStream.on('entry', function (obj) {
                                var fileDate = Math.floor(new Date(path.basename(obj.name, '.log')).getTime() / 1000);

                                if (startDate <= fileDate && endDate >= fileDate) {
                                    analyzeLogFiles.push(logPath + '/' + obj.name);
                                }
                            });

                            entriesStream.on('end', function () {
                                callback(null, analyzeLogFiles);
                            });

                            entriesStream.on('error', function (error) {
                                callback(error);
                            });
                        });
                    }
                }, function (vasyncErrors, analyzeLogFiles) {
                    if (vasyncErrors) {
                        return call.done(vasyncErrors);
                    }
                    analyzeLogFiles = [].concat.apply([], analyzeLogFiles.successes);
                    call.done(null, analyzeLogFiles);
                });
            }

            getFilesInDateRange(logs, startDate, endDate);
        }
    });

    server.onCall('DockerDeleteMachine', {
        verify: function (data) {
            return typeof data === 'object' &&
                data.hasOwnProperty('uuid') && data.hasOwnProperty('datacenter');
        },

        handler: function (call) {
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
                            Deleted: new Date(),
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
                }, function (vasyncError) {
                    if (vasyncError) {
                        var cause = vasyncError['jse_cause'] || vasyncError['ase_errors'] || vasyncError;
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
                                        removedContainerList = removedContainerList.concat(removedContainers);
                                        var hostId = call.data.uuid;
                                        if (Array.isArray(removedContainersCache[hostId])) {
                                            removedContainersCache[hostId] = removedContainerList.concat(removedContainersCache[hostId]);
                                        } else {
                                            removedContainersCache[hostId] = removedContainerList;
                                        }
                                        var duplicateRemovedContainers = {};
                                        removedContainersCache[hostId] = removedContainersCache[hostId].filter(function (removedContainer) {
                                            return removedContainer.Id in duplicateRemovedContainers ? 0 : duplicateRemovedContainers[removedContainer.Id] = removedContainer.Id;
                                        });
                                        if (removedContainersCache[hostId].length > 0) {
                                            removedContainersCache[hostId] = removedContainersCache[hostId].map(function (removedContainer) {
                                                if (call.data.uuid === removedContainer.hostId) {
                                                    removedContainer.hostState = 'removed';
                                                }
                                                return removedContainer;
                                            });
                                        }
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
                                var cause = err['jse_cause'] || err['ase_errors'] || err;
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
            host: DOCKER_HUB_HOST,
            port: '443',
            username: '',
            type: 'global'
        };
        Docker.getRegistries(call, function (error, list) {
            Docker.registriesCache['default'] = defaultRegistry;
            if (error) {
                if (error.statusCode === 404) {
                    return call.done(null, [defaultRegistry]);
                }
                if (error.code === 'AuthorizationFailed') {
                    error.message = 'Manta service is not available.';
                }
                return call.done(error, [defaultRegistry]);
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
                Docker.saveRegistries(call, list, function (errSave) {
                    if (errSave) {
                        return call.done(errSave);
                    }
                    savedRegistry.auth = null;
                    call.done(null, savedRegistry);
                });
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
                    Docker.listHosts(call, function (error, hosts) {
                        if (error) {
                            return call.done(error);
                        }
                        var machine = hosts.find(function (m) {
                            return m.primaryIp === host;
                        });
                        if (machine) {
                            waitClient(call, {primaryIp: host, id: machine.id}, function (error, client) {
                                if (error) {
                                    return call.done(error);
                                }
                                client.ping(function (errPing) {
                                    if (errPing) {
                                        return call.done(new Docker.DockerHostUnreachable(host).message, true);
                                    }
                                    client.containers({all: true}, function (err, containers) {
                                        if (err) {
                                            return call.done(err);
                                        }
                                        var matchingContainer = containers.find(function (container) {
                                            if (container.Status.indexOf('Exited') !== -1) {
                                                var isPrivateRegistryName = container.Names.some(function (name) {
                                                    return name === '/private-registry';
                                                });
                                                return isPrivateRegistryName && container.Image.indexOf('registry') !== -1;
                                            }
                                            return container.Ports.some(function (port) {
                                                return port.PublicPort === parseInt(registry.port, 10);
                                            });
                                        });
                                        if (matchingContainer) {
                                            var remove = function() {
                                                matchingContainer.hostId = machine.id;
                                                matchingContainer.hostName = machine.name;
                                                return removeContainer(call, client, matchingContainer, call.done.bind(call));
                                            };
                                            if (matchingContainer.Status.indexOf('Paused') === -1) {
                                                return remove();
                                            }
                                            client.unpause({id: matchingContainer.Id}, function (err) {
                                                if (err) {
                                                    return call.done(err);
                                                }
                                                remove();
                                            });
                                        } else {
                                            call.done();
                                        }
                                    });
                                });
                            });
                        } else {
                            call.done();
                        }
                    });
                } else {
                    call.done(null, 'OK');
                }
            });
        }
    });

    var pullImage = function (call, options, auth) {
        var entry = {
            host: call.data.host.id,
            entry: options.id,
            type: options.id ? 'image' : 'docker',
            name: 'pull'
        };
        Docker.createClient(call, call.data.host, function (error, client) {
            if (error) {
                return putToAudit(call, entry, options, error, true);
            }
            client.createImage(options, function (err, req) {
                if (err) {
                    return putToAudit(call, entry, options, err, true);
                }
                if (auth) {
                    req.setHeader('X-Registry-Auth', auth);
                }
                var error;
                req.on('result', function (error, res) {
                    if (error) {
                        return putToAudit(call, entry, options, error, true);
                    }

                    var layersMap = {};
                    jsonStreamParser(res, function (chunk) {
                        if (chunk.id) {
                            var oldChunk = layersMap[chunk.id];
                            if (!oldChunk ||
                                oldChunk.status !== chunk.status ||
                                chunk.progressDetail && oldChunk.progressDetail &&
                                    chunk.progressDetail.current - oldChunk.progressDetail.current > 5000000) {
                                call.update(null, chunk);
                                layersMap[chunk.id] = chunk;
                            }
                        } else {
                            if (chunk.error) {
                                error = chunk.errorDetail;
                            }
                            call.update(null, chunk);
                        }
                    });

                    res.on('end', function () {
                        putToAudit(call, entry, options, error, true);
                    });
                    res.on('error', function (error) {
                        putToAudit(call, entry, options, error, true);
                    });
                });
                req.end();
            });
        });
    };

    var getImageInfo = function (call, registryId, image, callback) {
        var registry = Docker.registriesCache[registryId];
        var infoOptions = {registry: registry, name: image.name, tag: image.tag};
        Docker.getImageInfo(call, infoOptions, callback);
    };

    server.onCall('DockerPull', {
        verify: function (data) {
            return data && data.host && data.host.primaryIp
                && data.options && data.options.fromImage;
        },
        handler: function (call) {
            var options = call.data.options;
            var registryId = options.registryId;
            var entry = {
                host: call.data.host.id,
                entry: options.id,
                type: options.id ? 'image' : 'docker',
                name: 'pull'
            };
            if (!registryId || registryId === 'local') {
                return pullImage(call, options);
            }
            Docker.getRegistry(call, registryId, function (error, registryRecord) {
                if (error) {
                    if (error.statusCode !== 404) {
                        return call.done(error.message);
                    }
                }
                if (!registryRecord && registryId === 'default') {
                    return putToAudit(call, entry, options, 'Please fill authentication information for the registry.', true);
                }

                registryRecord = registryRecord || {};
                var auth = registryRecord.auth || new Buffer(JSON.stringify({auth: '', email: ''})).toString('base64');

                getImageInfo(call, registryId, {name: call.data.options.fromImage, tag: call.data.options.tag}, function (err, result) {
                    if (err) {
                        return putToAudit(call, entry, options, err, true);
                    }
                    call.update(null, {totalSize: result.size});
                    pullImage(call, options, auth);
                });
            });
        }
    });

    server.onCall('DockerRegistryImages', {
        verify: function (data) {
            return data && data.registryId;
        },
        handler: function (call) {
            var registryId = call.data.registryId;
            var searchQuery = {};
            Docker.getRegistry(call, registryId, function (error, registryRecord) {
                if (error || !registryRecord  && registryId !== 'default') {
                    return call.done('Registry not found.');
                }
                registryRecord = registryRecord || {};
                if (registryRecord.type === 'remote' || registryRecord.type === 'global' || registryId === 'default') {
                    if (!registryRecord.username) {
                        return call.done(null, {images: []});
                    }
                    searchQuery.q = registryRecord.username;
                }

                Docker.createRegistryClient(call, registryRecord, function (error, registryClient) {
                    registryClient.searchImage(searchQuery, function (error, response) {
                        if (error || !(response && response.results)) {
                            return call.done(error, {images: []});
                        }
                        var results = response.results;
                        if (registryRecord.host === DOCKER_HUB_HOST) {
                            results = results.filter(function (image) {
                                return image.name.indexOf(registryRecord.username) === 0;
                            });
                        }
                        call.update(null, {images: results});
                        vasync.forEachParallel({
                            inputs: results,
                            func: function (image, callback) {
                                getImageInfo(call, registryId, {name: image.name}, function (err, result) {
                                    image.info = result;
                                    call.update(null, image);
                                    callback();
                                });
                            }
                        }, function (vasyncError) {
                            if (vasyncError) {
                                var cause = vasyncError['jse_cause'] || vasyncError['ase_errors'];
                                if (Array.isArray(cause)) {
                                    cause = cause[0];
                                } else {
                                    return call.done(vasyncError);
                                }
                                return call.done(cause, cause instanceof Docker.DockerHostUnreachable);
                            }

                            call.done(null);
                        });
                    });
                });
            });
        }
    });

    server.onCall('DockerRegistryRemoveImage', {
        verify: function (data) {
            return data && data.registryId && data.name;
        },
        handler: function (call) {
            var registryId = call.data.registryId;
            Docker.getRegistry(call, registryId, function (error, registryRecord) {
                if (error) {
                    return call.done(error.message || error);
                }

                registryRecord = registryRecord || {};
                var opts = {registry: registryRecord, image: call.data.name, access: 'DELETE'};
                if (registryRecord.type === 'local') {
                    opts.access = 'GET';
                }
                Docker.createIndexClient(call, opts, function (error, clients) {
                    if (error) {
                        return call.done(error.message || error, true);
                    }
                    clients.registry.removeImage({name: call.data.name}, function (error) {
                        call.done(error && error !== '""' && error || null);
                    });
                });
            });
        }
    });

    server.onCall('DockerRegistryImageTag', {
        verify: function (data) {
            return data && data.registryId && data.action && data.options.name && data.options.tagName && data.options.layoutId;
        },
        handler: function (call) {
            Docker.getRegistry(call, call.data.registryId, function (error, registryRecord) {
                if (error) {
                    return call.done(error.message || error);
                }

                registryRecord = registryRecord || {};
                var opts = {registry: registryRecord, image: call.data.options.name, access: 'POST'};
                if (registryRecord.type === 'local') {
                    opts.access = 'GET';
                }
                Docker.createIndexClient(call, opts, function (error, clients) {
                    if (error) {
                        return call.done(error.message || error, true);
                    }

                    clients.registry[call.data.action]({name: call.data.options.name, tag: call.data.options.tagName, forceRaw: true}, function (error, req) {
                        if (error) {
                            return call.done(error.message || error, true);
                        }
                        if (call.data.action === 'addImageTag') {
                            req.useChunkedEncodingByDefault = false;
                            req.setSocketKeepAlive(false);
                            req.setHeader('Content-type', 'text/plain');
                            req.setHeader('Content-length', call.data.options.layoutId.length);
                        }
                        req.write(call.data.options.layoutId);
                        req.on('result', function (err, res) {
                            if (err) {
                                return call.done(err.message || err.body.code || err);
                            }
                            res.on('data', function () {});
                            res.on('error', call.done.bind(call));
                            res.on('end', call.done.bind(call));
                        });
                        req.end();
                    });
                });
            });
        }
    });

    server.onCall('DockerUploadImage', {
        verify: function (data) {
            return data && data.host && data.host.primaryIp
                && data.options && data.options.image && data.options.image.Id && data.options.registry && data.options.name;
        },
        handler: function (call) {
            var options = call.data.options;
            var imageId = options.image.Id;
            var registry = options.registry;
            var name = options.name;
            var parsedTag = parseTag(name);
            var pipeline = [];
            var registryUrl = url.parse(registry.host).hostname + ':' + registry.port;
            var taggedName = parsedTag.repository + '/' + parsedTag.name;
            var entry = {
                host: call.data.host.id,
                entry: imageId,
                type: 'image',
                name: 'push'
            };
            if ((registryUrl === 'index.docker.io:443' || registry.type === 'global') && !parsedTag.repository) {
                taggedName = registry.username + '/' + parsedTag.name;
            } else if (registryUrl !== 'index.docker.io:443') {
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
                Docker.getRegistry(call, registry.id, function (error, registryRecord) {
                    if (error || !registryRecord) {
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
                    name: imageId,
                    repo: taggedName,
                    tag: (parsedTag.tag || 'latest')
                }, callback);
            });

            pipeline.push(function getImageSlices(collector, callback) {
                collector.client.historyImage({id: imageId}, function (error, slices) {
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
                    if (error.statusCode === 500 && !error.message) {
                        error.message = 'Private local registry is corrupted';
                    }
                    return putToAudit(call, entry, options, error, true);
                }
                putToAudit(call, entry, options, null, true);
            });
        }
    });

    server.onCall('DockerForceRemoveImage', {
        verify: function (data) {
            return data && data.options && data.options.id && data.host && data.host.primaryIp;
        },
        handler: function (call) {
            var dockerClient;
            var image;
            var imageShortId = call.data.options.id.substr(0, 12);
            vasync.waterfall([
                function (callback) {
                    Docker.createClient(call, call.data.host, callback);
                },
                function (client, callback) {
                    dockerClient = client;
                    client.images(function (imagesErr, images) {
                        callback(imagesErr, images);
                    });
                },
                function (images, callback) {
                    image = images.find(function (img) {
                        return img.Id.substr(0, 12) === imageShortId;
                    });
                    if (!image) {
                        return callback('Image "' + imageShortId + '" not found', true);
                    }
                    dockerClient.containers({all: true}, function (containersErr, containers) {
                        callback(containersErr, containers);
                    });
                },
                function (containers, callback) {
                    var usedByContainer = containers.find(function (container) {
                        return container.Image.substr(0, 12) === imageShortId || image.RepoTags && image.RepoTags.indexOf(container.Image) !== -1;
                    });
                    if (usedByContainer) {
                        callback('Image "' + imageShortId + '" is used by container "' + usedByContainer.Id.substr(0, 12) + '" and cannot be deleted');
                    } else {
                        callback();
                    }
                },
                function (callback) {
                    var tags = image.RepoTags || [image.Id];
                    var tagsMap = {};
                    tags.forEach(function (tag) {
                        var tagRepository = tag.split(':')[0];
                        tagsMap[tagRepository] = true;
                    });
                    var tagsCount = Object.keys(tagsMap).length;
                    var funcs = [];
                    for (var i = 0; i < tagsCount; i++) {
                        funcs.push(function (callback) {
                            dockerClient.removeImage({id: image.Id, force: true}, function (error) {
                                callback(error);
                            });
                        });
                    }
                    vasync.parallel({
                        funcs: funcs
                    }, callback);
                }
            ], call.done.bind(call));
        }
    });

    server.onCall('DockerImageTags', {
        verify: function (data) {
            return data && data.options && typeof (data.options.name) === 'string' && data.registry;
        },
        handler: function (call) {
            if (call.data.registry === 'local') {
                Docker.searchPrivateImageTags(call, call.data.options.name, call.done.bind(call));
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
            var pipeline = [];
            var installConfig = config.docker || {};
            var hostConfig = {
                ExposedPorts: {'5000/tcp': {}},
                Binds: ['/root/.ssh:/root/.ssh:ro'],
                PortBindings: {
                    '5000/tcp': [{HostIp: '127.0.0.1', HostPort: '5000'}]
                },
                RestartPolicy: {Name: 'always', MaximumRetryCount: 0}
            };

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
                collector.client.createImage({fromImage: 'registry', tag: (installConfig.registryVersion || 'latest')}, function (err, req) {
                    if (err) {
                        return callback(err);
                    }
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
                    req.end();
                });
            });

            pipeline.push(function createPrivateRegistryContainer(collector, callback) {
                var startupScript = 'if [ ! -f /.installed ];then apt-get update && apt-get install python-pip python-dev && ' +
                    'pip install docker-registry docker-registry-driver-joyent_manta' + (installConfig.registryDriverVersion ? '==' + installConfig.registryDriverVersion : '') + ' && ' +
                    'echo "' + registryConfig.replace(/\n/g, '\n').replace(/ {4}/g, '\t') + '" | sed -e \'s/\t/    /g\'>/config.yml;' +
                    'touch /.installed;else docker-registry;fi';
                collector.client.create({
                    name: 'private-registry',
                    Image: 'registry:' + (installConfig.registryVersion || 'latest'),
                    Env: [
                        'MANTA_KEY_ID=' + collector.fingerprint,
                        'MANTA_PRIVATE_KEY=/root/.ssh/user_id_rsa',
                        'MANTA_USER=' + mantaClient.user,
                        'MANTA_SUBUSER=' + Docker.SUBUSER_REGISTRY_LOGIN,
                        'SETTINGS_FLAVOR=dev',
                        'SEARCH_BACKEND=sqlalchemy',
                        'DOCKER_REGISTRY_CONFIG=/config.yml',
                        'REGISTRY_PORT=5000',
                        'STARTUP_SCRIPT=' + startupScript
                    ],
                    Cmd: ['/bin/bash', '-c', 'printenv STARTUP_SCRIPT | /bin/bash'],
                    Volumes: {
                        '/root/.ssh': {}
                    },
                    AttachStderr: true,
                    AttachStdin: true,
                    AttachStdout: true,
                    OpenStdin: true,
                    StdinOnce: true,
                    Tty: true,
                    HostConfig: hostConfig
                }, function (error, registry) {
                    collector.registry = registry;
                    callback(error);
                });
            });

            pipeline.push(function installRegistryDriver(collector, callback) {
                collector.client.start(util._extend({id: collector.registry.Id}, hostConfig), callback);
            });

            pipeline.push(function waitInstalling(collector, callback) {
                collector.client.logs({id: collector.registry.Id, follow: true}, callback);
            });

            vasync.pipeline({
                funcs: pipeline,
                arg: {}
            }, function (error) {
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
                            delete item.actionInProgress;
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

    server.onCall('DockerGetAudit', {
        verify: function (data) {
            return data;
        },
        handler: function (call) {

            var event = call.data.event || {type: 'docker'};
            var mantaClient = scope.api('MantaClient').createClient(call);
            var auditor = new Auditor(call, mantaClient);
            auditor.search(event.type, event.host, event.entry, function (err, data) {
                if (!data || err) {
                    if (err.statusCode === 404) {
                        return call.done(null, []);
                    }
                    return call.done(err, []);
                }
                if (!call.data.params) {
                    return call.done(null, data);
                }
                var suppressErrors = [];
                vasync.forEachParallel({
                    inputs: data,
                    func: function (item, callback) {
                        auditor.get(item, function (err, response) {
                            item.action = (item.name === 'run' || item.name === 'pull' || item.name === 'push') ? 'Key actions' : null;
                            if (err || !response) {
                                if (err.statusCode !== 404) {
                                    suppressErrors.push(err);
                                }
                                return callback(null, item);
                            }
                            item.parsedParams = response;
                            callback(null, item);
                        });
                    }
                }, function (vasyncError, operations) {
                    if (vasyncError) {
                        var cause = vasyncError['jse_cause'] || vasyncError['ase_errors'];
                        if (Array.isArray(cause)) {
                            cause = cause[0];
                        } else {
                            return call.done(vasyncError);
                        }
                        return call.done(cause);
                    }
                    var result = [].concat.apply([], operations.successes);
                    if (suppressErrors.length) {
                        result.push({suppressErrors: suppressErrors});
                    }
                    call.done(null, result);
                });
            });
        }
    });

    server.onCall('DockerGetAuditDetails', {
        verify: function (data) {
            return data && data.event;
        },
        handler: function (call) {
            var event = call.data.event;
            var mantaClient = scope.api('MantaClient').createClient(call);
            var auditor = new Auditor(call, mantaClient);
            event.date = new Date(event.npDate);
            auditor.get(event, function (err, data) {
                if (err && err.statusCode !== 404) {
                    return call.done(err);
                }
                call.done(null, data);
            });
        }
    });

    server.onCall('DockerAuditPing', function (call) {
        var mantaClient = scope.api('MantaClient').createClient(call);
        var auditor = new Auditor(call, mantaClient);
        auditor.ping(function (err, data) {
            if (err && err.statusCode !== 404) {
                return call.done(err);
            }
            call.done(null, data || []);
        });
    });

    server.onCall('DockerTerminalPing', {
        verify: function (data) {
            return data && data.machine && data.machine.primaryIp && data.containerId;
        },
        handler: function (call) {
            var data = call.data;
            Docker.createClient(call, data.machine, function (error, client) {
                if (error) {
                    return call.done(error);
                }
                var dockerUrl = client.options.url;
                var parsedUrl = url.parse(dockerUrl);
                parsedUrl.port = DOCKER_TCP_PORT;
                delete parsedUrl.host;
                client.options.url = url.format(parsedUrl);
                client.ping(function (err, result) {
                    call.done(err, result);
                });
            });
        }
    });

    server.onCall('DockerExecute', {
        verify: function (data) {
            return data && data.host && data.host.primaryIp && data.options && data.options.Cmd && data.options.id;
        },
        handler: function (call) {
            var data = call.data;
            var execOpts = {
                User: '',
                Privileged: false,
                Container: data.options.id,
                Detach: false,
                AttachStdin: true,
                AttachStdout: true,
                AttachStderr: true,
                Tty: true,
                Cmd: data.options.Cmd
            };
            Docker.createClient(call, data.host, function (error, client) {
                if (error) {
                    return call.done(error);
                }
                client.exec(util._extend({id: data.options.id}, execOpts), function (error, result) {
                    if (error) {
                        return call.done(error);
                    }
                    call.done(null, '/main/docker/exec/' + result.Id);
                    var wss = new WebSocket.Server({
                        server: httpServer,
                        path: '/main/docker/exec/' + result.Id
                    });
                    wss.once('connection', function (socket) {
                        function closeSocket() {
                            socket.close();
                            wss.close();
                        }
                        var dockerUrl = client.options.url;
                        var parsedUrl = url.parse(dockerUrl);
                        parsedUrl.port = DOCKER_TCP_PORT;
                        delete parsedUrl.host;
                        client.options.url = url.format(parsedUrl);
                        client.execStart(util._extend({id: result.Id}, execOpts), function (error, req) {
                            client.options.url = dockerUrl;
                            if (error) {
                                socket.send(error.message);
                                closeSocket();
                                return;
                            }
                            req.on('result', function (err, execRes) {
                                if (err) {
                                    socket.send(error.message);
                                    closeSocket();
                                    return;
                                }
                                socket.on('message', function (message) {
                                    req.connection.write(message.toString('ascii'));
                                });
                                socket.on('error', closeSocket);
                                execRes.on('data', function (data) {
                                    socket.send(data.toString());
                                });
                                execRes.on('error', function (error) {
                                    socket.send(error.message);
                                    closeSocket();
                                });
                                execRes.on('end', closeSocket);
                            });
                            req.write(JSON.stringify({
                                User: '',
                                Privileged: false,
                                Container: data.options.id,
                                Detach: false,
                                AttachStdin: true,
                                AttachStdout: true,
                                AttachStderr: true,
                                Tty: true,
                                Cmd: data.options.Cmd
                            }));
                        });
                    });
                });
            });
        }
    });
};

if (!config.features || config.features.docker !== 'disabled') {
    module.exports = Docker;
}
