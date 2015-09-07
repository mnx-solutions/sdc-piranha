'use strict';

(function (ng, app) {app.factory('Docker', ['serverTab', '$rootScope', 'errorContext', 'EventBubble', 'Machine', 'Image',
    'PopupDialog', 'Provision', 'localization', '$q', '$location', 'DockerCacheProvider', 'Storage', 'util', 'Account', 'notification',
    function (serverTab, $rootScope, errorContext, EventBubble, Machine, Image, PopupDialog, Provision,
              localization, $q, $location, DockerCacheProvider, Storage, util, Account, notification) {

        var dockerVersions = window.JP.get('dockerVersions');
        if ($rootScope.features && $rootScope.features.docker !== 'enabled' || !dockerVersions) {
            return;
        }

        var CONTAINER_CREATE = 'create';
        var CONTAINER_ACTIONS = {
            start: 'start',
            restart: 'restart',
            pause: 'pause',
            unpause: 'unpause',
            stop: 'stop',
            kill: 'kill',
            remove: 'remove',
            inspect: 'inspect',
            logs: 'logs'
        };

        var service = {cache: {}, jobs: {}, version: dockerVersions.dockerVersion};
        var imageActions = ['remove', 'inspect', 'history'];
        var caches = ['containers', 'images', 'topImages', 'registriesList'];
        caches.forEach(function (cache) {
            var options = null;
            if (cache === 'topImages') {
                options = {secondaryKey: 'primaryIp'};
            } else if (cache === 'registriesList') {
                options = {key: 'id'};
            }
            service.cache[cache] = new DockerCacheProvider(options);
        });

        var resetDockerCaches = function () {
            caches.forEach(function (cache) {
                if (service.cache[cache]) {
                    service.cache[cache].reset();
                }
            });
        };

        function showNotification(containerId, action) {
            var path = $location.path();
            if (containerId && action && path.indexOf('/docker/containers') === -1 && path.indexOf(containerId) === -1) {
                action = ['created', 'started', 'stopped', 'paused',
                    'unpaused', 'removed', 'restarted', 'killed'].find(function (actionInPast) {
                        return actionInPast.indexOf(action) !== -1;
                    });
                notification.success('Container "' + containerId.slice(0, 12) + '" is successfully ' + action + '.');
            }
        }

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

        $rootScope.$on('removeContainerFromDockerCache', function(event, machineId) {
            var cache = service.cache['containers'];
            if (cache && machineId) {
                var container = cache.list.find(function (container) {
                    return util.idToUuid(container.Id) === machineId;
                });
                if (container) {
                    cache.remove(container.Id);
                }
            }
        });

        var containerDoneHandler = {
            handler: function (options) {
                var container = options.cache.get(options.id);
                if (container && container.Status) {
                    switch (options.action) {
                        case CONTAINER_ACTIONS.pause:
                            container.Status += options.status;
                            break;
                        case CONTAINER_ACTIONS.unpause:
                            container.Status = container.Status.replace(options.status, '');
                            break;
                        default:
                            container.Status = options.status;
                    }
                    container.state = options.state || container.state;
                    options.cache.put(container);
                }
            },
            create: function (cache) {
                cache.reset();
            },
            start: function (cache, id, action) {
                this.handler({
                    action: action,
                    cache: cache,
                    id: id,
                    status: 'Up moments ago',
                    state: 'running'
                });
            },
            stop: function (cache, id, action) {
                this.handler({
                    action: action,
                    cache: cache,
                    id: id,
                    status: 'Exited (-1) moments ago',
                    state: 'stopped'
                });
            },
            pause: function (cache, id, action) {
                this.handler({
                    action: action,
                    cache: cache,
                    id: id,
                    status: ' (Paused)'
                });
            },
            remove: function (cache, id) {
                service.cache['registriesList'].reset();
                cache.remove(id);
            }
        };
        containerDoneHandler.unpause = containerDoneHandler.pause;
        containerDoneHandler.restart = containerDoneHandler.start;
        containerDoneHandler.kill = containerDoneHandler.stop;

        function capitalize(str) {
            return str[0].toUpperCase() + str.substr(1);
        }

        service.showUpgradeAnalyticsMessage = function (hostName) {
            PopupDialog.message(
                'New docker host analytics',
                'CAdvisor analytics is no longer supported. To upgrade host ' + hostName +
                    ' to the new analytics, please ssh to the host and run:<br/><code>sudo su<br/>' +
                    'wget ' + $location.protocol() + '://' + $location.host() + ':' + $location.port() +
                    '/installMemStat.sh <br/>. installMemStat.sh</code>',
                function () {}
            );
        };

        service.errorCallback = function (err, callback) {
            var messageMantaUnavailable = 'Manta service is not available.';
            if ((err && err.message && err.message.indexOf(messageMantaUnavailable) >= 0) ||
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

        service.goToDockerContainers = function () {
            $location.path('/docker/containers');
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
            var changeRegistryUserHost = function (registry) {
                var PROTOCOLS = ['http://', 'https://'];
                PROTOCOLS.forEach(function (protocol) {
                    if (registry.host.indexOf(protocol) > -1) {
                        registry.userHost = registry.host.replace(protocol, protocol + registry.username + '@');
                    }
                });
            };

            for (var i = registries.length - 1; i >= 0; i--) {
                var registry = registries[i];
                registry.userHost = registry.host;
                if (registry.username) {
                    changeRegistryUserHost(registry);
                } else if (excludeUnauthorizedDefaultRegistry && registry.host.indexOf('index.docker.io') !== -1) {
                    registries.splice(i, 1);
                }
            }
            return registries;
        };

        service.run = function (host, options, accountId) {
            var containerOptions = options.create;
            var containerFakeId = accountId + '-' + uuid();
            var provisioningContainer = {
                Command: containerOptions.cmd ? containerOptions.cmd.join(',') : '',
                Created: '',
                Id: containerFakeId,
                ShortId: '',
                Image: containerOptions.Image,
                NamesStr: containerOptions.name,
                Ports: containerOptions.PortSpecs,
                Status: '',
                hostId: host.id,
                hostName: host.name,
                ipAddress: '',
                isSdc: host.isSdc,
                Labels: containerOptions.Labels,
                state: 'provisioning',
                actionInProgress: true
            };
            var resetCache = function () {
                var cache = service.cache['containers'];
                if (cache && containerDoneHandler.create) {
                    containerDoneHandler.create(cache);
                }
            };
            resetCache();
            if ($location.path().indexOf('/container/create') !== -1) {
                if ($location.search().host === host.id) {
                    $location.path('/docker/containers');
                } else {
                    $location.url('/docker/containers');
                }
            }
            var job = serverTab.call({
                name: 'DockerRun',
                data: {host: host, options: options, provisioningContainer: provisioningContainer},
                done: function (error, job) {
                    showNotification(job.__read(), CONTAINER_CREATE);
                    resetCache();
                }
            });
            return job.promise;
        };

        service.getDockerContainersProvisioning = function (host) {
            var job = serverTab.call({
                name: 'GetDockerContainersProvisioning',
                data: {host: host}
            });
            return job.promise;
        };

        service.removeDockerContainersProvisioning = function (containerId) {
            var job = serverTab.call({
                name: 'RemoveDockerContainersProvisioning',
                data: {containerId: containerId}
            });
            return job.promise;
        };

        var doneHandler = {
            containers: function (err, data, options) {
                if (err && !(options && options.suppressErrors)) {
                    PopupDialog.errorObj(err);
                }
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
            images: function (err, data) {
                if (err) {
                    PopupDialog.errorObj(err);
                }
                if (data && data.length) {
                    data = data.filter(function (image) {
                        return image.ParentId || image.isSdc;
                    });
                }
                return data;
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
                if (err) {
                    PopupDialog.errorObj(err);
                }
                var registry = options.registry;
                if (registry.type === service.REGISTRY_LOCAL && service.cache['containers']) {
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
                var imageId = options.options.id;
                if (!err && cache) {
                    service.cache['images'].reset();
                    cache.remove(imageId);
                    cache.reset();
                } else if (cache) {
                    var cacheImage = cache.get(imageId);
                    if (cacheImage) {
                        delete cacheImage.isRemoving;
                        cache.put(cacheImage);
                    }
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
            return createJobCall(job, method, options, name, cache, jobKey);
        }

        function createJobCall(job, method, options, name, cache, jobKey) {
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
                    if (typeof err === 'object' && !err.error) {
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
                            return registry.host === 'https://' + container.primaryIp && registry.type === service.REGISTRY_LOCAL && !registry.processing;
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

        Object.keys(CONTAINER_ACTIONS).forEach(function (action) {
            action = CONTAINER_ACTIONS[action];
            service[action + 'Container'] = function (container, opts) {
                if (!container) {
                    return;
                }
                var options = {
                    direct: true,
                    host: {primaryIp: container.primaryIp, id: container.hostId, isSdc: container.isSdc},
                    options: angular.extend({}, container.options || {id: container.Id}, opts)
                };
                var cache = service.cache.containers;
                var cacheContainer = cache && cache.get(container.Id);
                if (action === 'remove') {
                    options.container = container;
                    options.options.force = true;
                    container.isRemoving = true;
                    if (cacheContainer) {
                        cacheContainer.isRemoving = true;
                        cache.put(cacheContainer);
                    }
                }
                var job = serverTab.call({
                    name: 'Docker' + capitalize(action),
                    data: options,
                    done: function (err, job) {
                        if (err) {
                            if (action === 'remove') {
                                delete container.isRemoving;
                                if (cacheContainer) {
                                    delete cacheContainer.isRemoving;
                                    cache.put(cacheContainer);
                                }
                            }
                            return false;
                        }
                        if (container.isSdc && action === 'remove') {
                            Machine.removeSdcFromInstancesList(util.idToUuid(container.Id));
                        }
                        if (containerDoneHandler[action]) {
                            if (container.Status &&
                                container.Status.indexOf('Paused') !== -1 &&
                                action !== CONTAINER_ACTIONS.unpause) {
                                PopupDialog.errorObj('Cannot ' + action + ' container ' + container.Id +
                                    '. Container ' + container.Id + '  is paused. Unpause the container.');
                            } else {
                                showNotification(options.options.id, action);
                                if (cache) {
                                    containerDoneHandler[action](cache, options.options.id, action);
                                }
                            }
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

        service.getContainerStats = function (options, progressCallback) {
            var url = util.rewriteUrl({
                href: '/main/docker/stats/' + options.containerId,
                isWS: true
            });
            var socket = new WebSocket(url.href);
            socket.onopen = function () {
                socket.send(JSON.stringify(options));
            };

            socket.onmessage = function (message) {
                if (message.data === 'ready') {
                    return;
                }
                try {
                    message = JSON.parse(message.data);
                } catch (e) {
                    return;
                }

                progressCallback(message);
            };

            return socket;
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

        service.searchImage = function (registryId, term) {
            return createCall('searchImage', {registry: registryId, options: {q: term}});
        };

        service.registryImages = function (registryId, onProgress) {
            return createCall('RegistryImages', {registryId: registryId}, onProgress);
        };

        service.setRemoving = function (cacheName, id) {
            var cache = service.cache[cacheName];
            var cacheItem = cache && cache.get(id);
            if (cacheItem) {
                cacheItem.isRemoving = true;
                cache.put(cacheItem);
            }
        };

        imageActions.forEach(function (action) {
            service[action + 'Image'] = function (image) {
                if (action === 'remove') {
                    service.setRemoving('topImages', image.Id);
                }
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

        service.pullForHosts = {};

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
            return createCall('getImageTags', {registry: registryId, options: {name: name}, direct: true}).then(function (tags) {
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
            var opts = {
                action: action,
                registryId: registryId,
                options: {name: name, tagName: tag, layoutId: layoutId},
                direct: true
            };
            return createCall('registryImageTag', opts);
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

        service.authorize = function (options, dockerHost) {
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
                    defer.resolve(hosts[0]);
                }, function (error) {
                    defer.reject(error);
                });
                return defer.promise;
            }

            return getHost(dockerHost).then(function (host) {
                var job = serverTab.call({
                    name: 'DockerAuthorize',
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
                        if (allowedHost && registry.type === service.REGISTRY_LOCAL && !privateRegistry) {
                            if (forHost && registry.host.indexOf(forHost) === -1) {
                                return;
                            }
                            var isRunningRegistryContainer = containers.some(function (container) {
                                return container.NamesStr === 'private-registry' && registry.host === 'https://' + container.primaryIp &&
                                    container.Status.indexOf('Up') !== -1 && container.Status.indexOf('(Paused)') === -1;
                            });
                            if (isRunningRegistryContainer) {
                                registries.push({
                                    id: service.REGISTRY_LOCAL,
                                    host: 'private registry',
                                    type: service.REGISTRY_LOCAL
                                });
                                privateRegistry = true;
                            }
                        } else if (registry.type !== service.REGISTRY_LOCAL) {
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
            return createCall('uploadImage', opts, function (error, chunks) {
                if (error) {
                    PopupDialog.errorObj(error);
                }
                chunks.forEach(function (chunk) {
                    if (chunk.status !== 'Pushing') {
                        opts.options.image.progress.push(chunk.status);
                    }
                });
            });
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
            service.setRemoving('topImages', options.options.id);
            return createCall('forceRemoveImage', ng.extend({}, options, {direct: true}));
        };

        service.getHost = function(hosts, ip) {
            var host = hosts.find(function (host) {
                return host.primaryIp === ip;
            });
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

        service.removeAudit = function (auditRecords) {
            return serverTab.call({
                name: 'removeAudit',
                data: auditRecords
            }).promise;
        };

        service.registryRemoveImage = function (options) {
            return createCall('registryRemoveImage', ng.extend({}, options, {direct: true}));
        };

        service.execute = function (opts) {
            return createCall('execute', opts);
        };

        service.loadPredefinedSearchParams = function () {
            var job = serverTab.call({
                name: 'LoadPredefinedSearchParams'
            });
            return job.promise;
        };

        service.savePredefinedSearchParams = function (predefinedSearchParams) {
            for (var key in predefinedSearchParams) {
                if (predefinedSearchParams.hasOwnProperty(key)) {
                    predefinedSearchParams[key] = predefinedSearchParams[key] || '';
                }
            }
            var job = serverTab.call({
                name: 'SavePredefinedSearchParams',
                data: {labelSearchParams: predefinedSearchParams}
            });
            return job.promise;
        };

        service.SdcPackage = function (datacenter) {
            var job = serverTab.call({
                name: 'SdcPackageList',
                data: {datacenter: datacenter}
            });
            return job.promise;
        };

        service.parseCmd = function (command) {
            if (!command || Array.isArray(command) && !command.length) {
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

        Account.getAccount().then(function (account) {
            if (account.provisionEnabled) {
                Storage.pingManta(function () {
                    service.getRegistriesList({cache: true});
                });
            }
        });

        service.getContainerState = function (containerInfo) {
            var containerState = 'stopped';
            if (containerInfo.State.Paused) {
                containerState = 'paused';
            } else if (containerInfo.State.Restarting) {
                containerState = 'restarting';
            } else if (containerInfo.State.Running && containerInfo.State.StartedAt) { // sdc-docker does not send State.StartedAt
                containerState = 'running';                                            // parameter if container is offline
            }
            return containerState;
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
            return ports.join(', ');
        };

        service.getContainersCount = function (tritonOnly, host) {
            return service.listContainers({host: host || 'All', options: {all: true}, suppressErrors: true}).then(function (containers) {
                if (!Array.isArray(containers)) {
                    containers = [];
                }
                if (tritonOnly) {
                    containers = containers.filter(function (container) {
                        return container.isSdc;
                    });
                }
                var runningContainers = containers.filter(function (container) {
                    return container.state === 'running' || container.Status.indexOf('Up ') === 0;
                });
                return {
                    running: runningContainers.length,
                    stopped: containers.length - runningContainers.length
                };
            });
        };

        service.getHostFilter = function (hostId, hosts) {
            if (hostId) {
                var hostFilter;
                hosts.some(function (host) {
                    if (host.id === hostId) {
                        hostFilter = host;
                        return true;
                    }
                });
                if (hostFilter) {
                    return {
                        host: hostFilter.isSdc ? '' : 'KVM host',
                        name: hostFilter.name
                    };
                }
            }
            return false;
        };

        service.memStat = function (options) {
            return createCall('memStat', options);
        };

        service.getLinkedContainers = function (links) {
            var names = links.map(function (link) {
                return link.slice(0, link.indexOf(':'));
            });
            return service.listContainers({host: 'All', cache: true, options: {all: true}, suppressErrors: true}).then(function (containers) {
                var linkedContainers = [];
                containers.forEach(function (container) {
                    names.forEach(function (name) {
                        if (container.Names.indexOf(name) !== -1 && !container.isRemoving) {
                            linkedContainers.push({
                                id: container.Id,
                                name: name.substring(1, name.length),
                                hostId: container.hostId
                            });
                        }
                    });
                });
                return linkedContainers;
            });
        };

        service.hasVmImages = function (datacenter) {
            if (Provision.isCurrentLocation('compute/container|compute/docker/welcome') && datacenter) {
                return $q.when(Image.image({datacenter: datacenter})).then(function (images) {
                    return Provision.hasVmImages(images, 'virtualmachine');
                });
            }
        };

        service.hasLinkedContainers = function (machine) {
            return service.listContainers({host: 'All', cache: true, options: {all: true}, suppressErrors: true}).then(function (containers) {
                var listNames = containers.map(function (container) {
                    return container.NamesStr;
                });
                var sdcContainer = containers.find(function (container) {
                    return util.idToUuid(container.Id) === machine.id;
                });
                if (!sdcContainer || sdcContainer.isRemoving) {
                    return;
                }
                return service.inspectContainer(sdcContainer).then(function (info) {
                    if (info.HostConfig.Links) {
                        return true;
                    }
                    if (sdcContainer.Names.length > 1) {
                        return sdcContainer.Names.forEach(function (name, i) {
                            if (i > 0) {
                                return listNames.some(function (listName) {
                                    if (name.indexOf(listName) !== -1) {
                                        return true;
                                    }
                                });
                            }
                        });
                    }
                    return false;
                }, function (err) {
                    if (Machine.isMachineDeleted(sdcContainer, err)) {
                        return;
                    }
                    PopupDialog.errorObj(err);
                });
            }, function (err) {
                PopupDialog.errorObj(err);
            });
        };

        service.getRegistryUrl = function (registry) {
            var parsedUrl = document.createElement('a');
            parsedUrl.href = registry.host.trim();
            var registryUrl = parsedUrl.hostname;

            if (registry.port && (parsedUrl.protocol === 'http:' && Number(registry.port) !== 80 ||
                parsedUrl.protocol === 'https:' && Number(registry.port) !== 443)) {
                registryUrl += ':' + registry.port;
            }

            return parsedUrl.protocol + '//' + registryUrl;
        };

        service.imageInProgress = {};

        service.REGISTRY_GLOBAL = 'global';
        service.REGISTRY_REMOTE = 'remote';
        service.REGISTRY_LOCAL = 'local';

        service.DEFAULT_REGISTRY_PORT = window.JP.get('dockerRegistryDefaultPort');

        service.AUTH_ACTION = 'authorize';
        service.PING_ACTION = 'registryPing';
        return service;
    }]);
}(window.angular, window.JP.getModule('docker')));
