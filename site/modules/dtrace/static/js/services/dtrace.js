'use strict';

(function (ng, app) {
    app.factory('DTrace', [
        'serverTab',
        'PopupDialog',
        '$q',
        '$rootScope',
        'Machine',
        function (serverTab, PopupDialog, $q, $rootScope, Machine) {

            if ($rootScope.features.dtrace !== 'enabled') {
                return;
            }

            var service = {};

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
                    data: { svg: data.svg, id: data.id }
                }).promise;
            };

            service.exucute = function (data) {
                return serverTab.call({
                    name: 'DtraceExecute',
                    data: { host: data.host, dtraceObj: data.dtraceObj }
                }).promise;
            }

        return service;
    }]);
}(window.angular, window.JP.getModule('dtrace')));
