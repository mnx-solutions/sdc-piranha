'use strict';

(function (ng, app) {app.factory('Docker', ['serverTab', '$rootScope', 'errorContext', 'EventBubble', 'Machine',
    'PopupDialog', 'localization', '$q', '$location', 'DockerCacheProvider', 'Storage',
    function (serverTab, $rootScope, errorContext, EventBubble, Machine, PopupDialog,
              localization, $q, $location, DockerCacheProvider, Storage) {

        if ($rootScope.features.docker !== 'enabled') {
            return;
        }

        var dockerVersions = window.JP.get('dockerVersions');
        var service = {cache: {}, jobs: {}, version: dockerVersions.dockerVersion};
        var containerActions = ['start', 'stop', 'pause', 'unpause', 'inspect', 'restart', 'kill', 'logs', 'remove'];
        var imageActions = ['remove', 'inspect', 'history'];
        var caches = ['containers', 'images', 'topImages', 'registriesList'];
        caches.forEach(function (cache) {
            service.cache[cache] = new DockerCacheProvider(cache === 'registriesList' ? {key: 'id'} : null);
        });

        var resetDockerCaches = function () {
            caches.forEach(function (cache) {
                service.cache[cache].reset();
            });
        };

        $rootScope.$on('clearDockerCache', function(event, data) {
            if (data) {
                service.hostInfo({host: data, wait: true}).then(function () {
                    $rootScope.dockerHostsAvailable = true;
                    resetDockerCaches();
                }, resetDockerCaches);
            } else {
                resetDockerCaches();
            }
        });

        var containerDoneHandler = {
            create: function (cache) {
                cache.reset();
            },
            start: function (cache, id) {
                var container = cache.get(id);
                if (container && container.Status && container.Status.indexOf('Paused') !== -1) {
                    PopupDialog.errorObj('Cannot start container ' + id + '. Container ' + id + '  is paused. Unpause the container.');
                }
                if (container && container.Status && container.Status.indexOf('Paused') === -1) {
                    container.containers = 'running';
                    container.Status = 'Up moments ago';
                    cache.put(container);
                }
            },
            stop: function (cache, id) {
                var container = cache.get(id);
                if (container && container.Status) {
                    container.containers = 'stopped';
                    container.Status = 'Exited (-1) moments ago';
                    cache.put(container);
                }
            },
            pause: function (cache, id) {
                var container = cache.get(id);
                if (container && container.Status) {
                    container.Status += ' (Paused)';
                    cache.put(container);
                }
            },
            unpause: function (cache, id) {
                var container = cache.get(id);
                if (container && container.Status) {
                    container.Status = container.Status.replace(' (Paused)', '');
                    cache.put(container);
                }
            },
            remove: function (cache, id) {
                service.cache['registriesList'].reset();
                cache.remove(id);
            }
        };
        containerDoneHandler.restart = containerDoneHandler.start;
        containerDoneHandler.kill = containerDoneHandler.stop;

        function capitalize(str) {
            return str[0].toUpperCase() + str.substr(1);
        }

        service.errorCallback = function (err, callback) {
            var messageMantaUnavailable = 'Manta service is not available.';
            if ((err.message && err.message.indexOf(messageMantaUnavailable) >= 0) ||
                (err && typeof (err) === 'string' && err.indexOf(messageMantaUnavailable) >= 0)) {
                errorContext.emit(new Error(localization.translate(null,
                    'docker',
                    'Our operations team is investigating.'
                    )));
            } else {
                PopupDialog.errorObj(err);
            }
            return callback();
        };

        service.getAuditButtonLabel = function (event) {
            var isAction = event.parsedParams && (event.action || event.parsedParams.error);
            return isAction ? (event.parsedParams.error ? 'Error' : 'Clone') : '';
        };

        service.pingHosts = function () {
            var job = serverTab.call({
                name: 'DockerPingHosts'
            });
            return job.promise;
        };

        service.addRegistryUsernames = function (registries, excludeUnauthorizedDefaultRegistry) {
            for (var i = registries.length - 1; i >= 0; i--) {
                var registry = registries[i];
                registry.userHost = registry.host;
                if (registry.username) {
                    var protocols = ['http://', 'https://'];
                    protocols.forEach(function (protocol) {
                        if (registry.host.indexOf(protocol) > -1) {
                            var hostAddress = registry.host.split(protocol)[1];
                            registry.userHost = protocol + registry.username + '@' + hostAddress;
                        }
                    });
                } else if (excludeUnauthorizedDefaultRegistry && registry.host.indexOf('index.docker.io') !== -1) {
                    registries.splice(i, 1);
                }
            }
            return registries;
        };

        service.run = function (host, options) {
            var job = serverTab.call({
                name: 'DockerRun',
                data: {host: host, options: options},
                done: function (err, data) {
                    var cache = service.cache['containers'];
                    if (cache && containerDoneHandler.create) {
                        containerDoneHandler.create(cache);
                    }
                    return data;
                }
            });
            return job.promise;
        };

        var doneHandler = {
            containers: function (err, data) {
                if (data && data.length) {
                    data.forEach(function (container) {
                        if (container.Names && container.Names.length) {
                            container.NamesStr = container.Names.map(function (name) {
                                return name.substring(1);
                            }).join(', ');
                        }
                        container.ShortId = container.Id.slice(0, 12);
                    });
                }
            },
            createRegistry: function (err, data, options) {
                var cache = service.cache['registriesList'];
                service.cache['containers'].reset();
                if (!cache && !cache.initialized && !options && !options.options) {
                    return;
                }
                var registry = options.options;
                if (err) {
                    cache.remove(registry.id);
                } else {
                    delete registry.processing;
                    cache.put(registry);
                }
            },
            deleteRegistry: function (err, data, options) {
                var registry = options.registry;
                if (registry.type === 'local' && service.cache['containers']) {
                    service.cache['containers'].reset();
                }
                var cache = service.cache['registriesList'];
                if (cache) {
                    cache.remove(registry.id);
                }
            },
            saveRegistry: function (err, registry) {
                var cache = service.cache['registriesList'];
                if (!cache || err) {
                    return;
                }
                cache.put(registry);
            },
            forceRemoveImage: function (err, data, options) {
                var cache = service.cache['topImages'];
                if (!err && cache) {
                    service.cache['images'].reset();
                    cache.reset();
                }
            },
            commit: function (err) {
                if (!err) {
                    service.cache['topImages'].reset();
                    service.cache['images'].reset();
                }
            }
        };
        doneHandler.removeImage = doneHandler.forceRemoveImage;
        doneHandler.pull = doneHandler.commit;

        /**
         * @param options.host {Object} - machine object
         * @param options.direct {Boolean} - direct call
         * @param options.cache {Boolean} - return result from cache if exists
         */
        function createCall(method, options, progressHandler, cacheKey) {
            var host = 'All';
            if (options && options.host) {
                host = options.host.primaryIp || 'All';
            }
            var jobKey = method + host + JSON.stringify(options || {});
            var job = service.jobs[jobKey];
            cacheKey = cacheKey || jobKey;
            var cache = service.cache[cacheKey];
            if (ng.isFunction(options)) {
                progressHandler = options;
                options = null;
            }
            progressHandler = progressHandler || ng.noop;
            if (options && !options.direct && options.cache && cache && cache.initialized) {
                return service.pingHosts().then(function () {
                    var defer = $q.defer();
                    setTimeout(function () {
                        defer.resolve(cache.list);
                    });
                    return defer.promise;
                }, function () {
                    resetDockerCaches();
                    options.cache = false;
                    return createCall(method, options, progressHandler);
                });
            }

            if (options && !options.direct && job) {
                job.$on('update', progressHandler);
                return job.promise;
            }

            job = service.jobs[jobKey] = EventBubble.$new();
            job.$on('update', progressHandler);

            var name = 'Docker' + capitalize(method);
            if (!options || options.host === 'All') {
                options = options || {};
                delete options.host;
                name += 'All';
            }
            options = options || {};
            var suppressErrors = options.suppressErrors;
            var lastIndex = 0;
            job.promise = serverTab.call({
                name: name,
                data: options,
                progress: function (error, data) {
                    if (!error && data) {
                        data = data.__read();
                        if (Array.isArray(data)) {
                            var length = data.length;
                            data = data.slice(lastIndex);
                            lastIndex = length;
                        } else {
                            data = [data];
                        }
                    }
                    job.$emit('update', error, data);
                },
                done: function (err, job) {
                    var data = job.__read();
                    if (suppressErrors) {
                        for (var i = 0; i < data.length;) {
                            var item = data[i];
                            if (item.hasOwnProperty('suppressErrors')) {
                                PopupDialog.errorObj(item.suppressErrors);
                                data.splice(i, 1);
                                options.cache = false;
                            } else {
                                i++;
                            }
                        }
                    }
                    if (method in doneHandler) {
                        doneHandler[method](err, data, options);
                    }
                    if (!err && options.cache && cache) {
                        cache.replace(data);
                    }
                    delete service.jobs[jobKey];
                },
                error: function (err) {
                    if (typeof (err) === 'object' && !err.error) {
                        err.error = err.syscall ? err.syscall + ' ' : '';
                        err.error += err.errno || '';
                    }
                    if (!suppressErrors) {
                        PopupDialog.errorObj(err);
                    }
                    if (method in doneHandler) {
                        doneHandler[method](err, null, options);
                    }
                    delete service.jobs[jobKey];
                }
            }).promise;

            return job.promise;
        }

        function createCachedCall(method, options, cacheName) {
            var host = options.host;
            if (!host || (host && host.toLowerCase() === 'all')) {
                cacheName = cacheName || method;
            } else {
                cacheName = cacheName || method + host;
            }
            return createCall(method, options, ng.noop, cacheName);
        }

        service.listContainers = function (options) {
            if (!options.host || options.host === 'All') {
                options.suppressErrors = options.suppressErrors || true;
            }
            if (options.cache) {
                return createCachedCall('containers', options);
            }
            return createCall('containers', options);
        };

        service.listHosts = function (options) {
            return createCall('hosts', options || {});
        };

        service.listRunningPrivateRegistryHosts = function () {
            return $q.all([
                createCall('containers', {host: 'All', cache: true}),
                createCall('getRegistriesList', {direct: true})
            ]).then(function (result) {
                var containers = result[0] || [];
                var registries = result[1] || [];
                var hosts = [];

                containers.forEach(function (container) {
                    if (container.NamesStr === 'private-registry' && container.Status.indexOf('Up') !== -1 && container.Status.indexOf('(Paused)') === -1) {
                        var allowedRegistry = registries.some(function (registry) {
                            return registry.host === 'https://' + container.primaryIp && registry.type === 'local' && !registry.processing;
                        });
                        if (allowedRegistry) {
                            hosts.push({primaryIp: container.primaryIp, name: container.hostName, id: container.hostId});
                        }
                    }
                });
                return hosts;
            });
        };

        service.completedHosts = function (options) {
            return createCall('completedHosts', options || {});
        };

        service.listImages = function (machine, options) {
            options = ng.extend({
                host: machine,
                options: {all: false}
            }, options);
            return createCall('images', options);
        };

        service.hostInfo = function (options, progressHandler) {
            return createCall('getInfo', options, progressHandler);
        };

        service.hostVersion = function (options) {
            return createCall('getVersion', options);
        };

        containerActions.forEach(function (action) {
            service[action + 'Container'] = function (container) {
                var options = {
                    direct: true,
                    host: {primaryIp: container.primaryIp, id: container.hostId, isSdc: container.isSdc},
                    options: container.options || {id: container.Id}
                };
                if (action === 'remove') {
                    options.container = container;
                    options.options.force = true;
                }
                var job = serverTab.call({
                    name: 'Docker' + capitalize(action),
                    data: options,
                    done: function (err, job) {
                        if (err) {
                            return false;
                        }
                        var cache = service.cache['containers'];
                        if (containerDoneHandler[action] && cache) {
                            containerDoneHandler[action](cache, options.options.id);
                        }
                        var data = job.__read();
                        if (action !== 'logs' && !data.containerId) {
                            data.containerId = options.options.id;
                        }
                        return data;
                    }
                });
                return job.promise;
            };
        });

        service.createImage = function (container) {
            return createCall('commit', {host: {primaryIp: container.primaryIp, id: container.hostId}, options: container});
        };

        service.listAllImages = function (params) {
            var defaultParams = {
                all: false,
                suppressErrors: true
            };
            if (params.cache) {
                return createCachedCall('images', {host: 'All', cache: true, options: ng.extend(defaultParams, params || {})}, params.all ? 'images' : 'topImages');
            }
            return createCall('images', {host: 'All', options: ng.extend(defaultParams, params || {})});
        };

        service.containerUtilization = function (options) {
            if (options.host && options.host.state !== 'running') {
                return;
            }
            var job = serverTab.call({
                name: 'DockerContainerUtilization',
                data: options,
                done: function (err, data) {
                    if (err) {
                        return false;
                    }
                    return data;
                }
            });
            return job.promise;
        };

        service.hostUtilization = function (options) {
            options = ng.extend({options: {'num_stats': 2}}, options);
            var job = serverTab.call({
                name: 'DockerHostUtilization',
                data: options,
                done: function (err, data) {
                    if (err) {
                        return false;
                    }
                    return data;
                }
            });
            return job.promise;
        };

        function getOverallUsage(machineInfo, hostStats) {
            var cur = hostStats.stats[hostStats.stats.length - 1];

            var cpuUsage = 0;
            var machineCores = machineInfo.cores || 1;
            if (hostStats.spec['has_cpu'] && hostStats.stats.length >= 2) {
                var prev = hostStats.stats[hostStats.stats.length - 2];
                var rawUsage = cur.cpu.usage.total - prev.cpu.usage.total;
                var intervalInNs = (new Date(cur.timestamp).getTime() - new Date(prev.timestamp).getTime()) * 1000000;

                cpuUsage = Math.round(((rawUsage / intervalInNs) / machineCores) * 100);
                if (cpuUsage > 100) {
                    cpuUsage = 100;
                }
            }

            var memoryUsage = 0;
            var machineMemory = machineInfo.memory * 1024 * 1024;
            if (hostStats.spec['has_memory']) {
                // Saturate to the machine size.
                var limit = hostStats.spec.memory.limit;
                if (limit > machineMemory) {
                    limit = machineMemory;
                }

                memoryUsage = Math.round((cur.memory.usage / limit) * 100);
            }
            return {cpu: cpuUsage, memory: memoryUsage};
        }

        service.hostUsage = function (options) {
            return service.hostUtilization(options).then(function (stats) {
                stats = Array.isArray(stats) ? stats.slice(-1)[0] : stats;
                return getOverallUsage(options.host, stats);
            });
        };

        service.searchImage = function (registryId, term) {
            return createCall('searchImage', {registry: registryId, options: {q: term}});
        };

        service.registryImages = function (registryId, onProgress) {
            return createCall('RegistryImages', {registryId: registryId}, onProgress);
        };

        imageActions.forEach(function (action) {
            service[action + 'Image'] = function (image) {
                return createCall(action + 'Image', {host: {primaryIp: image.primaryIp, id: image.hostId}, options: image.options || {id: image.Id}});
            };
        });

        function getCurrentSize(chunks) {
            var result = {};
            var current = 0;
            chunks.forEach(function (chunk) {
                var current = chunk.progressDetail && chunk.progressDetail.current;

                if (result[chunk.id] && !current && chunk.status === 'Download complete') {
                    result[chunk.id].current = result[chunk.id].total;
                } else if (current) {
                    result[chunk.id] = chunk.progressDetail;
                }
            });
            Object.keys(result).forEach(function (id) {
                current += result[id].current;
            });
            return current;
        }
        service.pullImage = function (host, image, registryId) {
            image.pullProcesses[host.id] = image.pullProcesses[host.id] || {};
            image.pullProcesses[host.id].progressDetail = image.pullProcesses[host.id].progressDetail || {};
            return createCall('pull', {host: host,
                options: {
                    fromImage: image.name,
                    tag: image.tag,
                    registry: image.registry,
                    repo: image.repository,
                    registryId: registryId
                }
            }, function (error, chunks) {
                var hostId = host.id;
                if (!hostId) {
                    var errorMessage = {message: 'Cannot pull image: internal error'};
                    return PopupDialog.errorObj(errorMessage);
                }
                chunks.forEach(function (chunk) {
                    if (chunk.error) {
                        image.pullProcesses[hostId].processStatus = 'Error';
                        var errorMessage = chunk.errorDetail || chunk;
                        if (chunk.error === 'HTTP code: 404') {
                            errorMessage.message = 'Cannot pull image “' + image.name + '”: not found.';
                        }
                        return PopupDialog.errorObj(errorMessage);
                    }
                    if (chunk.totalSize) {
                        image.pullProcesses[hostId].progressDetail.total = chunk.totalSize;
                    }
                    image.pullProcesses[hostId].processStatus = chunk.status || image.pullProcesses[hostId].processStatus;
                });

                image.pullProcesses[hostId].progressDetail.current = getCurrentSize(chunks);
            });
        };

        service.getImageTags = function (registryId, name) {
            return createCall('imageTags', {registry: registryId, options: {name: name}, direct: true}).then(function (tags) {
                if (!Array.isArray(tags)) {
                    var tagsArr = [];
                    for (var tagKey in tags) {
                        tagsArr.push({name: tagKey, id: tags[tagKey]});
                    }
                    tags = tagsArr;
                }
                return tags;
            });
        };

        service.registryImageTag = function (action, registryId, name, tag, layoutId) {
            return createCall('registryImageTag', {action: action, registryId: registryId, options: {name: name, tagName: tag, layoutId: layoutId}, direct: true});
        };

        service.registryPing = function (registry) {
            var job = serverTab.call({
                name: 'RegistryPing',
                data: registry,
                done: function (err, data) {
                    if (err) {
                        return false;
                    }
                    return data;
                }
            });
            return job.promise;
        };

        service.terminalPing = function (options) {
            var job = serverTab.call({
                name: 'DockerTerminalPing',
                data: options
            });
            return job.promise;
        };

        service.auth = function (options, dockerHost) {
            function getHost (host) {
                var defer = $q.defer();
                if (host) {
                    defer.resolve(host);
                    return defer.promise;
                }
                service.completedHosts().then(function (hosts) {
                    if (!hosts.length) {
                        defer.reject('You don\'t have installed Docker hosts');
                        return;
                    }
                    var notSdcHost = hosts.find(function (host) {
                        return !host.isSdc;
                    });

                    if (notSdcHost) {
                        defer.resolve(notSdcHost);
                        return;
                    }
                    defer.reject('SDC-Docker host doesn\'t support authentication. Please, create another docker host before connect.');
                }, function (error) {
                    defer.reject(error);
                });
                return defer.promise;
            }

            return getHost(dockerHost).then(function (host) {
                var job = serverTab.call({
                    name: 'DockerAuth',
                    data: {host: host, options: options},
                    done: function (err, data) {
                        if (err) {
                            return false;
                        }
                        return data;
                    }
                });
                return job.promise;
            }, function (error) {
                var defer = $q.defer();
                defer.reject(error);
                return defer.promise;
            });
        };

        service.getRegistriesList = function (options, forHost) {
            var call;
            options = options || {};
            if (options.cache) {
                call = createCachedCall('getRegistriesList', {cache: true}, 'registriesList');
            } else {
                call = createCall('getRegistriesList', {direct: true});
            }

            if (!options.aggregate) {
                return call;
            }
            var q = $q.defer();
            $q.all([
                call,
                createCall('containers', {host: 'All', cache: true, options: {all: true}, suppressErrors: true})
            ]).then(function (results) {
                var list = results[0] || [];
                var containers = results[1] || [];
                var privateRegistry = false;
                var registries = [];
                var allowedHost = true;
                if (forHost) {
                    allowedHost = list.some(function (registry) {
                        return registry.host.indexOf(forHost) !== -1;
                    });
                }
                list.forEach(function (registry) {
                    if (!registry.processing) {
                        if (allowedHost && registry.type === 'local' && !privateRegistry) {
                            if (forHost && registry.host.indexOf(forHost) === -1) {
                                return;
                            }
                            var isRunningRegistryContainer = containers.some(function (container) {
                                return container.NamesStr === 'private-registry' && registry.host === 'https://' + container.primaryIp &&
                                    container.Status.indexOf('Up') !== -1 && container.Status.indexOf('(Paused)') === -1;
                            });
                            if (isRunningRegistryContainer) {
                                registries.push({
                                    id: 'local',
                                    host: 'private registry',
                                    type: 'local'
                                });
                                privateRegistry = true;
                            }
                        } else if (registry.type !== 'local') {
                            registries.push(registry);
                        }
                    }
                });

                registries.sort(function (a, b) {
                    return (b.id === 'default') - (a.id === 'default');
                });
                q.resolve({short: registries, full: list});
            }, q.reject.bind(q));
            return q.promise;
        };

        service.saveRegistry = function (registry) {
            return createCall('saveRegistry', {registry: registry, direct: true});
        };

        service.deleteRegistry = function (registry) {
            var cache = service.cache['registriesList'];
            registry.processing = true;
            cache.put(registry);
            return createCall('deleteRegistry', {registry: registry, direct: true});
        };

        service.createNewRegistry = function (data) {
            var registry = data.registry;
            return createCall('saveRegistry', {registry: registry, direct: true}).then(function () {
                return createCall('createRegistry', {direct: true, host: data.host, options: registry});
            });
        };

        service.pushImage = function (opts) {
            return createCall('uploadImage', opts);
        };

        service.getImageTagsList = function (imageTags) {
            var repoTags = imageTags.map(function (repoTag) {
                var repoTagArray = repoTag.split(':');
                return repoTagArray[repoTagArray.length - 1];
            });
            return repoTags.join(', ');
        };

        service.parseTag = function parseTag(tag) {
            var parts = /(?:([^:]+:\d+)\/)?((?:([^\/]+)\/)?([^:]+))(?::(.+$))?/.exec(tag);
            if (!parts) {
                return {};
            }

            return {
                tag: parts[5],
                onlyname: parts[4],
                repository: parts[3] || '',
                name: parts[2] || '',
                registry: parts[1]
            };
        };

        service.getRemovedContainers = function () {
            var job = serverTab.call({
                name: 'GetRemovedContainers'
            });
            return job.promise;
        };

        service.removeDeletedContainerLogs = function (logs) {
            var job = serverTab.call({
                name: 'RemoveDeletedContainerLogs',
                data: {logs: logs}
            });
            return job.promise;
        };

        service.analyzeLogs = function (data) {
            var job = serverTab.call({
                name: 'DockerAnalyzeLogs',
                data: {logs: data.logs, dates: data.dates}
            });
            return job.promise;
        };

        service.forceRemoveImage = function (options) {
            return createCall('forceRemoveImage', ng.extend({}, options, {direct: true}));
        };

        service.getHost = function(hosts, ip) {
            var host = hosts.find(function (host) { return host.primaryIp === ip});
            return host ? host : {primaryIp: ip};
        };

        service.clone = function(name, host, params) {
            var action = {
                pull: function (host, params) {
                    return createCall('pull', {host: host, options: params});
                },
                run: function (host, params) {
                    return service.run(host, params);
                }
            };
            return action[name](host, params);
        };

        /**
         *  Audit methods
         */

        service.getAuditInfo = function (options) {
            return createCall('getAudit', ng.extend({}, options, {direct: true}));
        };

        service.getAuditDetails = function (options) {
            return createCall('getAuditDetails', ng.extend({}, options, {direct: true}));
        };

        service.auditPing = function () {
            return createCall('auditPing', {direct: true});
        };

        service.registryRemoveImage = function (options) {
            return createCall('registryRemoveImage', ng.extend({}, options, {direct: true}));
        };

        service.execute = function (opts, handler) {
            return createCall('execute', opts);
        };

        service.parseCmd = function (command) {
            if (!command) {
                return null;
            }
            return command.match(/(?:[^\s"']+|"([^"]*)"|'([^']*)')+/g).map(function (string) {
                var firstChar = string.substr(0, 1),
                    lastChar = string.substr(-1);

                if ((firstChar === '"' && lastChar === '"') ||
                    (firstChar === '\'' && lastChar === '\'')) {
                    string = string.slice(1, -1);
                }
                return string;
            });
        };

        Storage.pingManta(function () {
            service.getRegistriesList({cache: true});
        });

        service.idToUuid = function (dockerId) {
            return dockerId.substr(0, 8) + '-'
                + dockerId.substr(8, 4) + '-'
                + dockerId.substr(12, 4) + '-'
                + dockerId.substr(16, 4) + '-'
                + dockerId.substr(20, 12);
        };

        service.parsePorts = function (portsArray) {
            var ports = [];
            if (portsArray && portsArray.length) {
                portsArray.forEach(function (port) {
                    if (port.IP && port.PublicPort) {
                        ports.push(port.IP + ':' + port.PublicPort);
                    }
                });
            }
            return  ports.length ? ports.join(', ') : '';
        };

        return service;
    }]);
}(window.angular, window.JP.getModule('docker')));
