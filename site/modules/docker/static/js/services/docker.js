'use strict';


(function (ng, app) { app.factory('Docker', [
    'serverTab', '$q', 'EventBubble', 'Machine',
    function (serverTab, $q, EventBubble, Machine) {

        var service = {};
        var containerActions = ['start', 'stop', 'pause', 'unpause', 'remove', 'inspect', 'restart', 'kill', 'logs'];
        var imageActions = ['remove', 'inspect', 'history'];

        function capitalize(str) {
            return str[0].toUpperCase() + str.substr(1);
        }

        service.createContainer = function (params) {
            var job = serverTab.call({
                name: 'DockerCreate',
                data: {host: params.host, options: params.container},
                done: function (err, data) {
                    if (err) {
                        return false;
                    }
                    return data;
                }
            });
            return job.promise;
        };

        service.cache = {};
        service.jobs = {};

        /**
         * 
         * @param options.host {Object} - machine object
         * @param options.direct {Boolean} - direct call
         * @param options.cache {Boolean} - return result from cache if exists
         */
        function createCall(method, options, progressHandler) {
            var host = 'All';
            if (options && options.host) {
                host = options.host.primaryIp;
            }
            var jobKey = method + host + JSON.stringify(options || {});
            var job = service.jobs[jobKey];
            var cache = service.cache[jobKey];

            if (angular.isFunction(options)) {
                progressHandler = options;
                options = null;
            }
            progressHandler = progressHandler || angular.noop;
            if (options && !options.direct && options.cache && cache) {
                var defer = $q.defer();
                setTimeout(function () {
                    defer.resolve(cache);
                }, 1);
                return defer.promise;
            }

            if (options && !options.direct && job) {
                job.$on('update', progressHandler);
                return job.promise;
            }

            job = service.jobs[jobKey] = EventBubble.$new();
            job.$on('update', progressHandler);

            var name = 'Docker' + capitalize(method);
            if (!options || options.host === 'All') {
                delete (options && options.host);
                name += 'All';
            }
            options = options || {};
            job.promise = serverTab.call({
                name: name,
                data: {
                    host: options.host,
                    registry: options.registry,
                    wait: options.wait,
                    options: options.options
                },
                progress: function (error, data) {
                    if (!error && data) {
                        data = data.__read();
                        data = Array.isArray(data) && data.slice(-1)[0];
                    }
                    job.$emit('update', error, data);
                },
                done: function () {
                    delete service.jobs[jobKey];
                },
                error: function () {
                    delete service.jobs[jobKey];
                }
            }).promise;

            return job.promise;
        }

        service.listContainers = function (options) {
            return createCall('containers', options);
        };

        service.listHosts = function () {
            return Machine.listAllMachines().then(function (machines) {
                return machines.filter(function (machine) {
                    return machine.tags && machine.tags.JPC_tag === 'DockerHost';
                });
            });
        };

        service.listHostsFull = function (options) {
            return createCall('hosts', options || {});
        };

        service.listImages = function (machine, options) {
            options = angular.extend({
                host: machine,
                options: {all: false}
            }, options);
            return createCall('images', options);
        };

        service.hostInfo = function (options, progressHandler) {
            return createCall('getInfo', options, progressHandler);
        };

        containerActions.forEach(function (action) {
            service[action + 'Container'] = function (container) {
                var data = {
                    direct: true,
                    host: {primaryIp: container.primaryIp},
                    options: container.options || {id: container.Id}
                };
                return createCall(action, data);
            };
        });

        service.createImage = function (container) {
            return createCall('commit', {host: {primaryIp: container.primaryIp}, options: container});
        };

        service.listAllImages = function (params) {
            var defaultParams = {
                all: false
            };
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
            options = angular.extend({options: {num_stats: 2}}, options);
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
            if (hostStats.spec.has_cpu && hostStats.stats.length >= 2) {
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
            if (hostStats.spec.has_memory) {
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

        imageActions.forEach(function (action) {
            service[action + 'Image'] = function (image) {
                var job = serverTab.call({
                    name: 'Docker' + capitalize(action) + 'Image',
                    data: {host: {primaryIp: image.primaryIp}, options: image.options || {id: image.Id} },
                    done: function (err, data) {
                        if (err) {
                            return false;
                        }
                        return data;
                    }
                });
                return job.promise;
            };
        });

        service.pullImage = function (host, image) {
            return createCall('pull', {host: host, options: {fromImage: image.name, tag: image.tag}}, function (error, chunk) {
                image.progressDetail = chunk.hasOwnProperty('progressDetail') ? chunk.progressDetail : null;
                image.processStatus = chunk.status;
            });
        };

        service.getImageTags = function (registryId, name) {
            return createCall('imageTags', {registry: registryId, options: {name: name}, direct: true});
        };

        service.listRegistries = function () {
            var job = serverTab.call({
                name: 'listRegistries',
                done: function (err, data) {
                    if (err) {
                        return false;
                    }
                    return data;
                }
            });
            return job.promise;
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

        service.getRegistriesList = function () {
            return createCall('getRegistriesList', {direct: true});
        };

        service.saveRegistry = function (registry) {
            return createCall('saveRegistry', {registry: registry, direct: true});
        };

        service.deleteRegistry = function (registry) {
            return createCall('deleteRegistry', {registry: registry, direct: true});
        };

        service.createNewRegistry = function (opts) {
            return createCall('createRegistry', angular.extend({direct: true, host: opts.host, options: opts}));
        };

        return service;
    }]);
}(window.angular, window.JP.getModule('docker')));
