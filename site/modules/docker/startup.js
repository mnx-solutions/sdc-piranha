'use strict';
var config = require('easy-config');
var path = require('path');
var vasync = require('vasync');
var restify = require('restify');
var util = require('util');
var url = require('url');
var Auditor = require(__dirname + '/libs/auditor.js');
var utils = require('../../../lib/utils');
var DOCKER_SSL_ERROR = 'routines:SSL3_READ_BYTES';

var Docker = function execute(log, config) {
    var Docker = require('../docker').Docker;
    var server = require('../server').Server;
    var machine = require('../machine').Machine;
    var MantaClient = require('../storage').MantaClient;
    var DockerHandler = require(__dirname + '/libs/docker-handlers.js');
    var methods = Docker.getMethods();
    var methodsForAllHosts = ['containers', 'getInfo', 'images'];
    var DOCKER_LOGS_PATH = Docker.SDC_DOCKER_PATH + '/logs/';
    var DOCKER_REMOVED_LOGS_PATH = Docker.SDC_DOCKER_PATH + '/removed-logs.json';
    var DOCKER_EXEC_PATH = '/main/docker/exec/';
    var methodHandlers = {};
    var removedContainersCaches = {};

    var isPrivateRegistryName = function (container) {
        return container.Names.some(function (name) {
            return name === 'private-registry' ||  name === '/private-registry';
        });
    };

    function waitClient(call, host, callback) {
        var callOpts = call.data || {};
        var client = Docker.createClient(call, host);
        if (callOpts.wait && host.id && !callOpts.isSdc) {
            if (client.options.error) {
                return callback(client.options.error);
            }
            Docker.waitHost(call, host, function (status) {
                call.update(null, {hostId: host.id, status: status});
            }, function (error) {
                callback(error, client);
            });
        } else {
            callback(null, client);
        }
    }

    var getRemovedContainersList = function (call, callback) {
        var client = MantaClient.createClient(call);
        client.getFileJson(DOCKER_REMOVED_LOGS_PATH, function (error, list) {
            if (error) {
                call.log.warn('Removed docker containers list is corrupted');
                return callback(error, list);
            }
            callback(null, list);
        });
    };

    var saveRemovedContainersList = function (call, data, callback) {
        callback = callback || call.done;
        var userId = call.req.session.userId;
        var client = MantaClient.createClient(call);
        client.safePutFileContents(DOCKER_REMOVED_LOGS_PATH, JSON.stringify(data), function (error) {
            if (error && error.statusCode !== 404) {
                return callback(error.message, true);
            }
            removedContainersCaches[userId] = {};
            return callback(null);
        });
    };

    methods.forEach(function (method) {
        methodHandlers[method] = function (call, callback) {

            waitClient(call, call.data.host, function (error, client) {
                if (error) {
                    return callback(error, call.data.suppressErrors);
                }
                client[method](call.data.options, function (error) {
                    if (error === 'CAdvisor unavailable') {
                        callback(error, true);
                        return;
                    }
                    if (error && error.indexOf(DOCKER_SSL_ERROR) !== -1) {
                        arguments[0] = undefined;
                    }
                    callback.apply(this, arguments);
                });
            });
        };
    });

    ['start', 'stop', 'kill', 'restart'].forEach(function (method) {
        methodHandlers[method] = function (call, callback) {
            var containerId = call.data.options.id;
            waitClient(call, call.data.host, function (error, client) {
                if (error) {
                    return callback(error);
                }
                client[method](call.data.options, function (error) {
                    if (error === 'CAdvisor unavailable') {
                        callback(error, true);
                        return;
                    }
                    client.inspect({id: containerId}, function (errContainer, containerInfo) {
                        callback(null, containerInfo);
                    });
                });
            });
        };
    });

    function saveLogsToManta(call, logPath, logs, callback) {
        var mantaclient = MantaClient.createClient(call);
        // Fix to replace the unicode characters to their codes
        // Needs cause client tail log may contain raw unicode characters
        var fixedLogsString = JSON.stringify(logs).replace(/[\u007f-\uffff]/g,
            function (char) {
                return '\\u' + ('0000' + char.charCodeAt(0).toString(16)).slice(-4);
            });
        mantaclient.safePutFileContents(logPath, fixedLogsString, function (error) {
            return callback(error && error.message, true);
        });
    }

    function removeContainer(call, client, container, options, callback) {
        var hostId = container.hostId;
        var userId = call.req.session.userId;
        var logs = '';
        var logPath = path.join(DOCKER_LOGS_PATH, hostId, container.Id, Docker.getTomorrowDate() + '.log');
        if (typeof options === 'function') {
            callback = options;
            options = null;
        }
        options = options || {id: container.Id, v: true, force: true};
        return client.logs({id: container.Id, tail: 'all'}, function (err, response) {
            if (err) {
                return callback(err);
            }
            if (response && response.length) {
                logs = Docker.parseLogResponse(response);
            }
            saveLogsToManta(call, logPath, logs, function (error) {
                if (error) {
                    return callback(error);
                }

                client.remove(options, function (error) {
                    if (error && error.indexOf('devicemapper failed to remove root filesystem') === -1) {
                        return callback(error);
                    }
                    getRemovedContainersList(call, function (error, removedContainers) {
                        var duplicateRemovedContainers = {};
                        var removedContainer = {
                            Id: container.Id,
                            Image: container.Image,
                            Names: container.Names,
                            hostId: container.hostId,
                            hostName: container.hostName,
                            Deleted: new Date(),
                            ShortId: container.ShortId
                        };
                        if (error) {
                            if (error.statusCode === 404) {
                                removedContainers = [];
                            } else {
                                return callback(error.message, true);
                            }
                        }
                        if (container.isSdc) {
                            removedContainer.isSdc = true;
                        }
                        removedContainers.push(removedContainer);
                        var removedContainersCache = removedContainersCaches[userId] = removedContainersCaches[userId] || {};
                        if (Array.isArray(removedContainersCache[hostId])) {
                            removedContainersCache[hostId] = removedContainers.concat(removedContainersCache[hostId]);
                        } else {
                            removedContainersCache[hostId] = removedContainers;
                        }
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
        var host = data.host;
        var container = data.container;
        waitClient(call, host, function (error, client) {
            if (error) {
                return callback(error);
            }
            return removeContainer(call, client, container, data.options, function (err) {
                var ports = [];
                if (err) {
                    if (typeof err === 'string' && err.indexOf('Cannot destroy container') !== -1) {
                        callback(err);
                    }
                    return call.log.warn(err.message || err, true);
                }
                if (container.Ports && container.Ports.length > 0) {
                    ports = container.Ports.map(function (port) {
                        return port.PublicPort;
                    });
                } else {
                    ports = isPrivateRegistryName(container) && container.Image.indexOf('private-registry') >= 0 ? [Docker.DEFAULT_REGISTRY_PORT] : [];
                }
                if (ports.length) {
                    // delete registry
                    return Docker.getRegistries(call, function (error, list) {
                        var matchingRegistryId;
                        list = list.filter(function (item) {
                            if (url.parse(item.host).hostname === host.primaryIp) {
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
                            Docker.registriesCache.delete(call, matchingRegistryId);
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
    };

    methods.forEach(function (method) {
        server.onCall('Docker' + utils.capitalize(method), {
            verify: function (data) {
                return data && data.host && typeof data.host.primaryIp === 'string';
            },
            handler: function (call) {
                if (call.data.host.prohibited) {
                    return call.done(null, {});
                }
                methodHandlers[method](call, call.done.bind(call));
            }
        });

        if (methodsForAllHosts.indexOf(method) !== -1) {
            server.onCall('Docker' + utils.capitalize(method) + 'All', function (call) {
                Docker.listHosts(call, function (error, hosts) {
                    var suppressErrors = [];
                    if (error) {
                        return call.done(error);
                    }
                    hosts = hosts.filter(function (host) {
                        return !host.prohibited;
                    });
                    vasync.forEachParallel({
                        inputs: hosts,
                        func: function (host, callback) {
                            Docker.getHostStatus(call, host, function (error, status) {
                                if (error || status !== 'completed') {
                                    return callback(null, []);
                                }

                                var client = Docker.createClient(call, host);
                                client[method](util._extend({}, call.data.options), function (err, response) {
                                    if (err) {
                                        if (err.indexOf(DOCKER_SSL_ERROR) !== -1) {
                                            Docker.setHostStatus(call, host.id, 'unreachable');
                                        } else {
                                            suppressErrors.push(err);
                                        }
                                        return callback(null, []);
                                    }
                                    if (response && Array.isArray(response)) {
                                        response.forEach(function (container) {
                                            container.hostName = host.name;
                                            container.hostId = host.id;
                                            container.primaryIp = host.primaryIp;
                                            container.isSdc = host.isSdc;
                                            if (method === 'containers') {
                                                container.state = container.Status.indexOf('Up') !== -1 ? 'running' : 'stopped';
                                            }
                                        });
                                    }
                                    if (method === 'containers') {
                                        vasync.forEachParallel({
                                            inputs: response,
                                            func: function (container, inspectCallback) {
                                                if (container.Created === 0 || !container.Status ||
                                                    ['Removal In Progress', 'Dead', 'Created'].indexOf(container.Status) > -1) {
                                                    if (!container.Status || container.Status === 'Created') {
                                                        container = [];
                                                    }
                                                    return inspectCallback(null, container);
                                                }
                                                client.inspect({id: container.Id}, function (errContainer, containerInfo) {
                                                    if (errContainer) {
                                                        suppressErrors.push(errContainer);
                                                        return inspectCallback(null, []);
                                                    }
                                                    container.ipAddress = containerInfo.NetworkSettings.IPAddress;
                                                    container.labels = containerInfo.Config.Labels;
                                                    inspectCallback(null, container);
                                                });
                                            }
                                        }, function (vasyncErrs, containers) {
                                            var data = utils.getVasyncData(vasyncErrs, containers);
                                            callback(data.error, data.result);
                                        });
                                    } else {
                                        callback(null, response);
                                    }
                                });
                            });
                        }
                    }, function (vasyncErrors, operations) {
                        var data = utils.getVasyncData(vasyncErrors, operations, suppressErrors);
                        if (vasyncErrors) {
                            var error = data.error;
                            return call.done(error, error !== vasyncErrors && error instanceof Docker.DockerHostUnreachable);
                        }

                        call.done(null, data.result);
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
                    var client = Docker.createClient(call, host);
                    client.ping(function (err) {
                        if (err && (err.indexOf(DOCKER_SSL_ERROR) !== -1 ||
                            err.indexOf(Docker.CERTIFICATES_LOST) !== -1)) {
                            err = Docker.CERTIFICATES_LOST.replace('r.', 'r host ') + host.primaryIp + ' (' + host.name + ').';
                        }
                        callback(err);
                    });
                }
            }, function (vasyncError) {
                if (vasyncError) {
                    call.log.warn({errors: vasyncError['ase_errors'] || vasyncError});
                }
                call.done();
            });
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
                    Docker.getHostStatus(call, host, function (error, status) {
                        if (error || status !== 'completed') {
                            callback(null, []);
                        }
                        if (status === 'completed') {
                            if (getVersion) {
                                var client = Docker.createClient(call, host);
                                client.getVersion(function (error, version) {
                                    if (error) {
                                        return callback(null, []);
                                    }

                                    host.dockerVersion = version;
                                    callback(null, [host]);
                                });
                                return;
                            }
                            callback(null, [host]);
                        }
                    });
                }
            }, function (vasyncErrors, operations) {
                var data = utils.getVasyncData(vasyncErrors, operations);
                call.done(data.error, data.result);
            });
        });
    });

    server.onCall('DockerRun', {
        verify: function (data) {
            return data && data.host && data.options && data.options.create && data.options.create.Image &&
                data.options.start && data.provisioningContainer;
        },
        handler: function (call) {
            var provisioningContainer = call.data.provisioningContainer;
            var containerFakeId = provisioningContainer.Id;
            var cachedContainers = call.req.session.containers = call.req.session.containers || {};
            cachedContainers[containerFakeId] = provisioningContainer;
            DockerHandler.run(call, function (error, containerId) {
                if (error) {
                    var container = cachedContainers[containerFakeId];
                    container.actionInProgress = false;
                    container.error = error;
                    cachedContainers[containerFakeId] = container;
                    call.done();
                } else {
                    delete cachedContainers[containerFakeId];
                    call.done(null, containerId);
                }
            });
        }
    });

    server.onCall('RemoveDockerContainersProvisioning', {
        verify: function (data) {
            return data && data.containerId;
        },
        handler: function (call) {
            var cachedContainers = call.req.session.containers = call.req.session.containers || {};
            delete cachedContainers[call.data.containerId];
            call.done();
        }
    });

    server.onCall('GetDockerContainersProvisioning', function (call) {
        var provisioningContainers = {};
        var cachedContainers = call.req.session.containers = call.req.session.containers || {};
        Object.keys(cachedContainers).forEach(function (key) {
            var value = cachedContainers[key];
            if (!call.data.host || call.data.host === value.host) {
                provisioningContainers[key] = value;
            }
        });
        call.done(null, provisioningContainers);
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
        var client = MantaClient.createClient(call);
        function getRemovedContainers(logs, callback) {
            vasync.forEachPipeline({
                func: function (removedContainerLog, callback) {
                    getRemovedContainersList(call, function (error, removedContainers) {
                        var logPath = path.join(DOCKER_LOGS_PATH, removedContainerLog.hostId, removedContainerLog.Id);
                        var hostRemovedContainersCount;
                        if (error) {
                            return callback(error.message, true);
                        }
                        hostRemovedContainersCount = removedContainers.filter(function (removedContainer) {
                            return removedContainer.hostId === removedContainerLog.hostId;
                        }).length;
                        removedContainers = removedContainers.filter(function (removedContainer) {
                            return removedContainer.Id !== removedContainerLog.Id;
                        });
                        if (removedContainerLog.hostState === 'removed' && hostRemovedContainersCount === 1) {
                            logPath = path.join(DOCKER_LOGS_PATH, removedContainerLog.hostId);
                        }
                        client.rmr(logPath, function (error) {
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
            return typeof data === 'object' && data.hasOwnProperty('logs') && data.hasOwnProperty('dates');
        },
        handler: function (call) {
            var client = MantaClient.createClient(call);
            var logs = call.data.logs;
            var startDate = call.data.dates.start;
            var endDate = call.data.dates.end + 86400;

            function getFilesInDateRange(logs, startDate, endDate) {
                vasync.forEachParallel({
                    inputs: logs,
                    func: function (log, callback) {
                        var analyzeLogFiles = [];
                        var logPath = path.join(DOCKER_LOGS_PATH, log.hostId, log.Id);
                        client.ftw(logPath, function (err, entriesStream) {
                            var errorCallback = function (error) {
                                if (error.statusCode === 404) {
                                    return callback(null, []);
                                }
                                return callback(error);
                            };

                            if (err) {
                                return errorCallback(err);
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

                            entriesStream.on('error', errorCallback);
                        });
                    }
                }, function (vasyncErrors, analyzeLogFiles) {
                    var data = utils.getVasyncData(vasyncErrors, analyzeLogFiles);
                    call.done(data.error, data.result);
                });
            }

            getFilesInDateRange(logs, startDate, endDate);
        }
    });

    server.onCall('DockerDeleteMachine', {
        verify: function (data) {
            return typeof data === 'object' && data.hasOwnProperty('uuid') && data.hasOwnProperty('datacenter');
        },
        handler: function (call) {
            var options = {
                uuid: call.data.uuid,
                datacenter: call.data.datacenter
            };
            var hostId = call.data.uuid;
            var userId = call.req.session.userId;
            var removedContainerList = [];
            var getHostContainers = function (call, callback) {
                var client = Docker.createClient(call, call.data.host, true);
                client.containers({all: true}, function (error, containers) {
                    return callback(error, containers, client);
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
                            hostId: hostId,
                            hostName: call.data.host.hostName,
                            Deleted: new Date(),
                            hostState: 'removed'
                        };
                        removedContainerList.push(removedContainer);
                        client.logs({id: hostContainer.Id, tail: 'all'}, function (err, response) {
                            var logs = '';
                            var logPath = path.join(DOCKER_LOGS_PATH, hostId, hostContainer.Id, Docker.getTomorrowDate() + '.log');
                            if (err) {
                                return callback(err);
                            }
                            if (response && response.length) {
                                logs = Docker.parseLogResponse(response);
                            }
                            saveLogsToManta(call, logPath, logs, function (error) {
                                callback(error);
                            });
                        });
                    }
                }, function (vasyncErrors) {
                    if (vasyncErrors) {
                        call.log.warn({error: utils.getVasyncError(vasyncErrors)}, 'Error while persisting container logs');
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
                                        var duplicateRemovedContainers = {};
                                        if (error) {
                                            if (error.statusCode === 404) {
                                                removedContainers = [];
                                            } else {
                                                return callback(error.message);
                                            }
                                        }
                                        removedContainerList = removedContainerList.concat(removedContainers);
                                        var removedContainersCache = removedContainersCaches[userId] = removedContainersCaches[userId] || {};
                                        if (Array.isArray(removedContainersCache[hostId])) {
                                            removedContainersCache[hostId] = removedContainerList.concat(removedContainersCache[hostId]);
                                        } else {
                                            removedContainersCache[hostId] = removedContainerList;
                                        }
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
                        }, function (errors) {
                            if (errors) {
                                call.log.warn({error: utils.getVasyncData(errors).error}, 'Error while updating registries list');
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
            var registry = call.data;
            var pipeline = [];

            pipeline.push(function (next) {
                if (registry.api) {
                    return next(null, registry.api);
                }

                Docker.getRegistryVersion(call, registry, function (error, apiVersion) {
                    next(error, apiVersion);
                });
            });

            pipeline.push(function (apiVersion, next) {
                registry.api = apiVersion;
                var client = Docker.createRegistryClient(call, registry);

                client.ping(function (err, result) {
                    if (result && Array.isArray(result.errors)) {
                        return next(result.errors.pop());
                    }
                    next(err, {status: result, apiVersion: apiVersion});
                });
            });

            vasync.waterfall(pipeline, function (error, result) {
                call.done(error && (error.code || error.message || error), result);
            });
        }
    });

    server.onCall('DockerGetRegistriesList', function (call) {
        var defaultRegistry = {
            id: 'default',
            api: 'v1',
            host: Docker.DOCKER_HUB_HOST,
            port: '443',
            username: '',
            type: Docker.REGISTRY_GLOBAL
        };
        Docker.getRegistries(call, function (error, list) {
            var checkDefaultRegistry = false;
            Docker.registriesCache.put(call, 'default', defaultRegistry);
            if (error) {
                if (error.statusCode === 404) {
                    return call.done(null, [defaultRegistry]);
                }
                if (error.code === 'AuthorizationFailed') {
                    error.message = 'Manta service is not available.';
                }
                return call.done(error, [defaultRegistry]);
            }
            list.forEach(function (registry) {
                Docker.registriesCache.put(call, registry.id, util._extend({}, registry));
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
            var auth = {auth: '', email: ''};
            if (savedRegistry.username && savedRegistry.password && savedRegistry.password.length > 0 && savedRegistry.email) {
                auth = {
                    username: savedRegistry.username,
                    password: savedRegistry.password,
                    email: savedRegistry.email,
                    serveraddress: savedRegistry.host + '/' + savedRegistry.api + '/'
                };
            }
            savedRegistry.auth = new Buffer(JSON.stringify(auth)).toString('base64');
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
                Docker.registriesCache.put(call, savedRegistry.id, savedRegistry);
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
                if (registry.type === Docker.REGISTRY_LOCAL) {
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
                                client.containers({all: true}, function (err, containers) {
                                    if (err) {
                                        return call.done(err);
                                    }
                                    var matchingContainer = containers.find(function (container) {
                                        if (container.Status.indexOf('Exited') !== -1) {
                                            return isPrivateRegistryName(container) && container.Image.indexOf('registry') !== -1;
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

    server.onCall('DockerPull', {
        verify: function (data) {
            return data && data.host && data.host.primaryIp && data.options && data.options.fromImage;
        },
        handler: function (call) {
            DockerHandler.pull(call);
        }
    });

    server.onCall('DockerRegistryImages', {
        verify: function (data) {
            return data && data.registryId;
        },
        handler: function (call) {
            DockerHandler.getRegistryImages(call);
        }
    });

    server.onCall('DockerRegistryRemoveImage', {
        verify: function (data) {
            return data && data.registryId && data.name;
        },
        handler: function (call) {
            DockerHandler.removeRegistryImage(call);
        }
    });

    server.onCall('DockerRegistryImageTag', {
        verify: function (data) {
            return data && data.registryId && data.action && data.options.name && data.options.tagName && data.options.layoutId;
        },
        handler: function (call) {
            DockerHandler.tagRegistryImage(call);
        }
    });

    server.onCall('DockerUploadImage', {
        verify: function (data) {
            return data && data.host && data.host.primaryIp &&
                data.options && data.options.image && data.options.image.Id && data.options.registry && data.options.name;
        },
        handler: function (call) {
            DockerHandler.uploadImage(call);
        }
    });

    server.onCall('DockerForceRemoveImage', {
        verify: function (data) {
            return data && data.options && data.options.id && data.host && data.host.primaryIp;
        },
        handler: function (call) {
            DockerHandler.forceRemoveImage(call);
        }
    });

    function createRegistryRequest(requestName) {
        return function (call) {
            var registry = Docker.registriesCache.getItem(call, call.data.registry);
            if (!registry) {
                return;
            }
            call.data.authNotRequired = call.data.registry !== Docker.REGISTRY_LOCAL;
            var client = Docker.createRegistryClient(call, registry);
            var requestFunction = client[requestName];

            if (!client) {
                return call.done();
            }

            if (typeof requestFunction === 'function') {
                requestFunction.call(client, call.data.options, call.done.bind(call));
            } else {
                call.done();
            }
        };
    }

    server.onCall('DockerGetImageTags', {
        verify: function (data) {
            return data && data.options && typeof data.options.name === 'string' && data.registry;
        },
        handler: createRegistryRequest('getImageTags')
    });

    server.onCall('DockerSearchImage', {
        verify: function (data) {
            return data && data.options && typeof data.options.q === 'string' && data.registry;
        },
        handler: createRegistryRequest('searchImage')
    });

    server.onCall('DockerCreateRegistry', {
        verify: function (data) {
            return data && data.host && data.host.primaryIp && data.options && data.options.api;
        },
        handler: function (call) {
            DockerHandler.createRegistry(call);
        }
    });

    server.onCall('DockerGetAudit', {
        verify: function (data) {
            return data;
        },
        handler: function (call) {
            var event = call.data.event || {type: 'docker'};
            var auditor = new Auditor(call);
            auditor.search(event.type, event.host, event.entry, function (err, data) {
                var suppressErrors = [];
                if (!data || err) {
                    if (err.statusCode === 404) {
                        return call.done(null, []);
                    }
                    return call.done(err, []);
                }
                data.forEach(function(item) {
                    item.hostId = Docker.isSdcHost(item.host) ? 'N/A' : item.host;
                });
                if (!call.data.params) {
                    return call.done(null, data);
                }
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
                }, function (vasyncErrors, operations) {
                    var data = utils.getVasyncData(vasyncErrors, operations, suppressErrors);
                    call.done(data.error, data.result);
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
            var auditor = new Auditor(call);
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
        var auditor = new Auditor(call);
        auditor.ping(function (err, data) {
            if (err && err.statusCode !== 404) {
                return call.done(err);
            }
            call.done(null, data || []);
        });
    });

    server.onCall('removeAudit', {
        verify: function (data) {
            return data && Array.isArray(data);
        },
        handler: function (call) {
            var auditor = new Auditor(call);
            vasync.forEachParallel({
                inputs: call.data,
                func: function (item, callback) {
                    item.date = new Date(item.date);
                    auditor.del(item, callback);
                }
            }, function (err) {
                if (err) {
                    return call.done(err);
                }
                call.done();
            });
        }
    });

    server.onCall('DockerTerminalPing', {
        verify: function (data) {
            return data && data.machine && data.machine.primaryIp && data.containerId;
        },
        handler: function (call) {
            var data = call.data;
            var client = Docker.createClient(call, data.machine);
            if (!data.machine.isSdc) {
                client = client.usePort(Docker.DOCKER_TCP_PORT);
            }
            client.ping(function (err, result) {
                call.done(err, result);
            });
        }
    });

    server.onCall('DockerExecute', {
        verify: function (data) {
            return data && data.host && data.host.primaryIp && data.options;
        },
        handler: function (call) {
            var host = call.data.host;
            var execOpts = call.data.options;
            var client = Docker.createClient(call, host);
            client.exec(util._extend({id: execOpts.Container}, execOpts), function (error, result) {
                if (error) {
                    return call.done(error);
                }
                call.done(null, DOCKER_EXEC_PATH + result.Id);
            });
        }
    });

    server.onCall('LoadPredefinedSearchParams', function (call) {
        call.done(null, call.req.session.labelSearchParams || {});
    });

    server.onCall('SavePredefinedSearchParams', {
        verify: function (data) {
            return data && data.labelSearchParams;
        },
        handler: function (call) {
            call.req.session.labelSearchParams = call.data.labelSearchParams;
            call.req.session.save();
            call.done();
        }
    });

    server.onCall('SdcPackageList', function (call) {
        var sdcDockerConfig = [].concat(config.sdcDocker).find(function (sdcConfig) {
            return sdcConfig.datacenter === call.data.datacenter;
        });

        if (!sdcDockerConfig || !sdcDockerConfig.packagePrefix) {
            return call.done(null, []);
        }
        var options = {
            datacenter: call.data.datacenter
        };
        machine.PackageList(call, options, function (error, list) {
            if (error) {
                return call.done(error);
            }
            list = list.filter(function (pkg) {
                // TODO cleanup when G4 packages will be implemented
                return pkg.name.indexOf(sdcDockerConfig.packagePrefix) !== -1 || pkg.name.indexOf('g4-') !== -1;
            });
            call.done(null, list);
        });
    });

    server.onCall('DockerAuthorize', {
        verify: function (data) {
            return data && data.options && data.options.serveraddress;
        },
        handler: function (call) {
            var registry = call.data.options;
            Docker.getRegistryVersion(call, registry, function (error, apiVersion) {
                if (error) {
                    return call.done(error.message || error);
                }
                var dockerClient = Docker.createClient(call, call.data.host);
                dockerClient.auth({
                    username: registry.username,
                    password: registry.password,
                    email: registry.email,
                    serveraddress: registry.serveraddress
                }, function (error, response) {
                    response = response || {};
                    response.apiVersion = apiVersion;
                    call.done(error, response);
                });
            });
        }
    });
};

if (!config.features || config.features.docker !== 'disabled') {
    module.exports = Docker;
}
