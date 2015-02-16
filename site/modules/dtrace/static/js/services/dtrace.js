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

            service.getScriptsList = function () {
                return serverTab.call({
                    name: 'GetScripts'
                }).promise;
            };

            service.listHosts = function () {
                return Machine.listAllMachines().then(function (machines) {
                    return machines.filter(function (machine) {
                        return machine.tags && machine.tags['JPC_tag'] === 'DTraceHost';
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

        return service;
    }]);
}(window.angular, window.JP.getModule('dtrace')));
