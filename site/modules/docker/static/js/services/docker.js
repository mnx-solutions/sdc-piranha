'use strict';


(function (ng, app) {
    app.factory('Docker', [
        'serverTab',
        '$q',
        function (serverTab, $q) {

        var service = {};
        var cacheContainers = null;
        var containerActions = ['start', 'stop', 'pause', 'unpause', 'remove', 'inspect', 'restart', 'kill', 'logs', 'list'];

        function capitalize(str) {
            return str[0].toUpperCase() + str.substr(1);
        }

        service.listHosts = function (call) {
            var job = serverTab.call({
                name: 'DockerHosts',
                done: function (err, data) {
                    if (err) {
                        return false;
                    }
                    return data;
                }
            });
            return job.promise;
        };

        service.hostInfo = function (machine) {
            var job = serverTab.call({
                name: 'DockerGetInfo',
                data: {host: machine},
                done: function (err, data) {
                    if (err) {
                        return false;
                    }
                    return data;
                }
            });
            return job.promise;
        };

        service.listImages = function (machine) {
            var job = serverTab.call({
                name: 'DockerImages',
                data: {host: machine, options: {all: false}},
                done: function (err, data) {
                    if (err) {
                        return false;
                    }
                    return data;
                }
            });
            return job.promise;
        };

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

        containerActions.forEach(function (action) {
            service[action + 'Container'] = function (container) {
                var job = serverTab.call({
                    name: 'Docker' + capitalize(action),
                    data: {host: {primaryIp: container.primaryIp}, options: container.options || {id: container.Id} },
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

        service.createImage = function (container) {
            var job = serverTab.call({
                name: 'DockerCommit',
                data: {host: {primaryIp: container.primaryIp}, options: container},
                done: function (err, data) {
                    if (err) {
                        return false;
                    }
                    return data;
                }
            });
            return job.promise;
        };

        service.listAllContainers = function (params) {
            var defaultParams = {
                all: true
            };
            var job = serverTab.call({
                name: 'DockerContainersAll',
                data: ng.extend(defaultParams, params || {}),
                done: function (err, data) {
                    if (err) {
                        return false;
                    }
                    return data;
                }
            });
            return job.promise;
        };

        service.listAllImages = function (params) {
            var defaultParams = {
                all: false
            };
            var job = serverTab.call({
                name: 'DockerImagesAll',
                data: ng.extend(defaultParams, params || {}),
                done: function (err, data) {
                    if (err) {
                        return false;
                    }
                    return data;
                }
            });
            return job.promise;
        };

        service.listContainers = function (update) {
            var deferred = $q.defer();
            if (cacheContainers && !update) {
                deferred.resolve(cacheContainers);
            } else {
                serverTab.call({
                    name: 'DockerContainersAll',
                    data: {all: true},
                    done: function (err, data) {
                        if (err) {
                            deferred.reject(err);
                            return;
                        }
                        cacheContainers = data.__read();
                        deferred.resolve(cacheContainers);
                    }
                });
            }
            return deferred.promise;
        };

        service.containerUtilization = function (host, containerId, num_stats) {
            if (host && host.state !== 'running') {
                return;
            }
            var job = serverTab.call({
                name: 'DockerContainerUtilization',
                data: {
                    host: host,
                    options: {
                        id: containerId,
                        num_stats: num_stats || 60
                    }
                },
                done: function (err, data) {
                    if (err) {
                        return false;
                    }
                    return data;
                }
            });
            return job.promise;
        };

        service.hostUtilization = function (machine) {
            return serverTab.call({
                name: 'DockerHostUtilization',
                data: {
                    host: machine,
                    options: {
                        num_stats: 2
                    }
                }
            }).promise;
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

        service.hostUsage = function (machine) {
            return service.hostUtilization(machine).then(function (stats) {
                return getOverallUsage(machine, stats);
            });
        };

        service.listContainers(true);

        service.searchImage = function(host, term) {
            var job = serverTab.call({
                name: 'DockerSearchImage',
                data: {host: host, options: {term: term}},
                done: function (err, data) {
                    if (err) {
                        return false;
                    }
                    return data;
                }
            });
            return job.promise;
        };

        service.removeImage = function(image) {
            var job = serverTab.call({
                name: 'DockerRemoveImage',
                data: {host: {primaryIp: image.primaryIp}, options: {id: image.Id}},
                done: function (err, data) {
                    if (err) {
                        return false;
                    }
                    return data;
                }
            });
            return job.promise;
        };

        service.pullImage = function(host, image) {
            var job = serverTab.call({
                name: 'DockerPull',
                data: {host: host, options: {fromImage: image.name}},
                progress: function (err, job) {
                    var data = job.__read();
                    data.forEach(function (chunk) {
                        image.progressDetail = chunk.hasOwnProperty('progressDetail') ? chunk.progressDetail : null;
                        image.processStatus = chunk.status;
                    });
                },
                done: function (err, data) {
                    if (err) {
                        return false;
                    }
                    return data;
                }
            });
            return job.promise;
        };

        return service;
    }]);
}(window.angular, window.JP.getModule('docker')));
