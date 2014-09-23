'use strict';


(function (ng, app) {
    app.factory('Docker', [
        'serverTab',
        function (serverTab) {

        var service = {};

        service.listHosts = function(call) {
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

        service.hostInfo = function(machine) {
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

        service.inspectContainer = function (machine, containerid) {
            var job = serverTab.call({
                name: 'DockerInspect',
                data: {
                    host: machine,
                    options: {id: containerid}
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

        service.getContainerLogs = function (machine, containerid) {
            var job = serverTab.call({
                name: 'DockerLogs',
                data: {
                    host: machine,
                    options: {id: containerid}
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
