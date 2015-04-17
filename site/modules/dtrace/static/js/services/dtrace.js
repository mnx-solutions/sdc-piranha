'use strict';

(function (ng, app) {
    app.factory('DTrace', [
        'serverTab',
        'PopupDialog',
        '$q',
        '$rootScope',
        'Machine',
        'loggingService',
        function (serverTab, PopupDialog, $q, $rootScope, Machine, loggingService) {

            var service = {};

            service.devToolsLink = function () {
                var devToolsLink = '';
                if ($rootScope.features.mdb === 'enabled') {
                    devToolsLink = '#!/devtools/mdb';
                } else if ($rootScope.features.dtrace === 'enabled') {
                    devToolsLink = '#!/devtools/dtrace';
                }
                return devToolsLink;
            };

            if ($rootScope.features && $rootScope.features.dtrace !== 'enabled') {
                return service;
            }

            service.createScript = function (script) {
                return serverTab.call({
                    name: 'SaveScript',
                    data: script
                }).promise;
            };

            service.removeScript = function (ids) {
                return serverTab.call({
                    name: 'DeleteScripts',
                    data: {ids: ids}
                }).promise;
            };

            service.getScriptsList = function (type) {
                return serverTab.call({
                    name: 'GetScripts',
                    data: {type: type}
                }).promise;
            };

            service.listHosts = function () {
                return Machine.listAllMachines().then(function (machines) {
                    return machines.filter(function (machine) {
                        return machine.tags && machine.tags['JPC_tag'] === 'DTraceHost' && machine.state === 'running';
                    });
                });
            };

            service.hostStatus = function (machine) {
                return serverTab.call({
                    name: 'DtraceHostStatus',
                    data: {host: machine.primaryIp}
                }).promise;
            };

            service.listProcesses = function (machine) {
                return serverTab.call({
                    name: 'DtraceListProcesses',
                    data: {host: machine.primaryIp}
                }).promise;
            };

            service.saveFlameGraph = function (data) {
                return serverTab.call({
                    name: 'SaveFlameGraph',
                    data: {svg: data.svg, id: data.id}
                }).promise;
            };

            service.execute = function (data) {
                var deferred = $q.defer();
                serverTab.call({
                    name: 'DtraceExecute',
                    data: {host: data.host, dtraceObj: data.dtraceObj},
                    done: function (err, job) {
                        if (err) {
                            deferred.reject(err);
                        } else {
                            var data = job.__read();
                            var a = document.createElement('a');
                            a.href = data.path;
                            a.protocol = a.protocol === 'http:' ? 'ws:' : 'wss:';
                            deferred.resolve({id: data.id, path: a.href});
                        }
                    }
                });
                return deferred.promise;
            };

            service.close = function (data) {
                return serverTab.call({
                    name: 'DtraceClose',
                    data: data,
                }).promise;
            };

            service.reportError = function (errMessage, logMessage) {
                logMessage = logMessage || errMessage;
                PopupDialog.errorObj(errMessage);
                loggingService.log('error', logMessage);
            };

            return service;
        }]);

}(window.angular, window.JP.getModule('dtrace')));
