'use strict';


(function (ng, app) {
    app.factory('Docker', [
        'serverTab',
        '$q',
        function (serverTab, $q) {

        var service = {};
        var cacheContainers = null;
        var containerActions = ['start', 'stop', 'pause', 'unpause', 'remove', 'inspect', 'restart', 'kill', 'logs'];

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

        service.listContainers = function (machine) {
            var job = serverTab.call({
                name: 'DockerContainers',
                data: {host: machine, options: {all: 1}},
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

        service.listAllContainers = function (params) {
            var defaultParams = {
                size: true,
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


        service.hostContainers = function(machine) {
            var job = serverTab.call({
                name: 'DockerGetContainers',
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

        service.listContainers = function (update) {
            var deferred = $q.defer();
            if (cacheContainers && !update) {
                deferred.resolve(cacheContainers);
            } else {
                serverTab.call({
                    name: 'DockerContainersAll',
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

        return service;
    }]);
}(window.angular, window.JP.getModule('docker')));
