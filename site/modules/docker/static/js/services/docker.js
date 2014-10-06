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
