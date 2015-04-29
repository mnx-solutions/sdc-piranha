'use strict';

(function (app) {
    app.directive('containerDetails', [
        'Machine',
        'Docker',
        '$q',
        'requestContext',
        'localization',
        '$location',
        'util',

        function (Machine, Docker, $q, requestContext, localization, $location, util) {
        return {
            restrict: 'EA',
            scope: true,

            link: function (scope) {
                requestContext.setUpRenderContext('docker.details', scope, {
                    title: localization.translate(null, 'docker', 'View Joyent Container Details')
                });
                var containerId = requestContext.getParam('containerid');
                var hostId = requestContext.getParam('hostid');
                var machineId = requestContext.getParam('machineid');
                var container = {
                    Id: containerId
                };
                scope.isUnreachable = false;

                var errorCallback = function () {
                    scope.loading = false;
                };
                if (!containerId && !hostId) {
                    Docker.listHosts({prohibited: true}).then(function (hosts) {
                        hosts.some(function (host) {
                            if (host.isSdc) {
                                hostId = host.id;
                                Docker.listContainers({
                                    host: host,
                                    cache: false,
                                    options: {all: true},
                                    suppressErrors: true
                                }).then(function (containers) {
                                    containers.some(function (container) {
                                        if (container.Id.substring(0, 32) === machineId.replace(/-/g, '')) {
                                            containerId = container.Id;
                                            getDockerInspectContainer(host);
                                            return true;
                                        }
                                    });
                                }, function () {
                                    scope.isUnreachable = true;
                                });
                                return true;
                            }
                        });
                    });
                }

                scope.loading = true;
                scope.execCmd = '';

                var getDockerInspectContainer = function (host) {
                    container.Id = container.Id || containerId;
                    container.primaryIp = host.primaryIp;
                    container.hostId = host.id;
                    container.isSdc = host.isSdc;
                    scope.termOpts = {
                        machine: host,
                        containerId: containerId,
                        isSdc: host.isSdc
                    };
                    machineId = machineId || util.idToUuid(containerId);
                    var machineIpAddresses = null;
                    var machine = $q.when(Machine.machine(machineId));
                    machine.then(function (instanceMachine) {
                        machineIpAddresses = instanceMachine.ips.join(', ');
                    });
                    Docker.inspectContainer(container).then(function (info) {
                        var containerCmd = info.Config.Cmd;
                        if (Array.isArray(containerCmd)) {
                            containerCmd = info.Config.Cmd.join(' ');
                        }
                        var containerState = Docker.getContainerState(info) || 'process';
                        scope.termOpts.containerState = containerState;
                        scope.container = {
                            name: info.Name.substring(1),
                            cmd: containerCmd,
                            entrypoint: info.Config.Entrypoint,
                            Ports: info.Config.ExposedPorts,
                            hostname: info.Config.Hostname,
                            image: info.Config.Image,
                            memory: info.Config.Memory,
                            cpuShares: info.Config.CpuShares,
                            created: info.Created,
                            state: containerState,
                            infoId: info.Id,
                            ipAddress: machineIpAddresses || info.NetworkSettings.IPAddress,
                            isSdc: host.isSdc,
                            Uuid: util.idToUuid(container.Id)
                        };
                        scope.loading = false;
                    }, errorCallback);
                    Docker.logsContainer(container).then(function (logs) {
                        scope.containerLogs = [];
                        if (logs && typeof (logs) === 'string') {
                            logs = logs.split(/[\r\n]+/);
                            if (Array.isArray(logs)) {
                                logs.forEach(function (str) {
                                    scope.containerLogs.push(str);
                                });
                            } else {
                                scope.containerLogs.push(logs);
                            }
                        }
                    }, errorCallback);
                    Docker.getAuditInfo({event: {type: 'container', host: hostId, entry: containerId}, params: true}).then(function(info) {
                        scope.audit = info || [];
                        scope.audit.forEach(function (event) {
                            event.hostName = host.name || host.id;
                        });
                    }, errorCallback);
                };

                var getDockerHost = function () {
                    var host = $q.when(Docker.listHosts({id:hostId}));
                    host.then(function (host) {
                        getDockerInspectContainer(host);
                    }, function () {
                        $location.path('/docker/containers');
                    });
                };

                if (containerId && hostId) {
                    getDockerHost();
                }
            },

            templateUrl: 'docker/static/partials/details-summary.html'
        };
    }]);
}(window.JP.getModule('Machine')));
