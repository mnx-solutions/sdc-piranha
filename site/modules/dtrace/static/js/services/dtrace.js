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

            service.reportError = function (errMessage, logMessage, logLevel) {
                logMessage = logMessage || errMessage;
                PopupDialog.errorObj(errMessage);
                loggingService.log(logLevel || 'error', logMessage);
            };

            return service;
        }]);

}(window.angular, window.JP.getModule('dtrace')));
