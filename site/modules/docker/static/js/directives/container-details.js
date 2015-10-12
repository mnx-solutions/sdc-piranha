'use strict';

(function (app) { app.directive('containerDetails', [
    'Machine', 'Docker', '$q', 'requestContext', 'localization', '$location', 'util',

    function (Machine, Docker, $q, requestContext, localization, $location, util) {
        return {
            restrict: 'EA',
            scope: true,

            link: function (scope) {
                requestContext.setUpRenderContext('docker.details', scope, {
                    title: localization.translate(null, 'docker', 'View ' + scope.companyName + ' Container Details')
                });
                var containerId = requestContext.getParam('containerid');
                var hostId = requestContext.getParam('hostid');
                var machineId = requestContext.getParam('machineid');
                var container = {
                    Id: containerId
                };
                scope.isUnreachable = false;
                scope.linkedContainers = null;
                scope.goTo = function (linkedContainer) {
                    containerId = linkedContainer.id;
                    hostId = linkedContainer.hostId;
                    container = {
                        Id: containerId
                    };
                    if ($location.path().indexOf('compute') !== -1) {
                        $location.path('/docker/container/' + hostId + '/' + containerId);
                    } else {
                        scope.$parent.goTo(linkedContainer);
                        scope.loading = true;
                        getDockerHost();
                    }
                };

                var errorCallback = function () {
                    scope.loading = false;
                };
                if (!containerId && !hostId) {
                    Docker.listHosts({prohibited: true}).then(function (hosts) {
                        var host = hosts.find(function (host) {
                            return host.isSdc && host.datacenter === scope.machine.datacenter;
                        });
                        if (host) {
                            hostId = host.id;
                            containerId = machineId.replace('-', '').substr(0, 12);
                            getDockerInspectContainer(host);
                        }
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
                    if (host.isSdc) {
                        var machine = $q.when(Machine.machine(machineId));
                        machine.then(function (instanceMachine) {
                            machineIpAddresses = instanceMachine.ips.join(', ');
                            if (host.isSdc && instanceMachine.state === 'deleting') {
                                return Docker.goToDockerContainers();
                            }
                            inspectContainer();
                        }, Docker.goToDockerContainers);
                    } else {
                        inspectContainer();
                    }
                    function inspectContainer() {
                        Docker.inspectContainer(container).then(function (containerInfo) {
                            var containerCmd = containerInfo.Config.Cmd;
                            containerId = container.Id = containerInfo.Id;
                            if (Array.isArray(containerCmd)) {
                                containerCmd = containerInfo.Config.Cmd.join(' ');
                            }
                            var containerState = Docker.getContainerState(containerInfo) || 'process';
                            scope.termOpts.containerState = containerState;
                            scope.container = {
                                name: containerInfo.Name.substring(1),
                                cmd: containerCmd,
                                labels: containerInfo.Config.Labels,
                                entrypoint: containerInfo.Config.Entrypoint,
                                Ports: containerInfo.Config.ExposedPorts,
                                hostname: containerInfo.Config.Hostname,
                                image: containerInfo.Config.Image,
                                memory: containerInfo.Config.Memory,
                                cpuShares: containerInfo.Config.CpuShares,
                                created: containerInfo.Created,
                                state: containerState,
                                infoId: containerInfo.Id,
                                ipAddress: machineIpAddresses || containerInfo.NetworkSettings.IPAddress,
                                isSdc: host.isSdc,
                                Uuid: util.idToUuid(container.Id)
                            };
                            if (containerInfo.HostConfig.Links) {
                                Docker.getLinkedContainers(containerInfo.HostConfig.Links).then(function (linkedContainers) {
                                    scope.linkedContainers = linkedContainers;
                                });
                            } else {
                                scope.linkedContainers = [];
                            }
                            scope.loading = false;

                            Docker.getAuditInfo({event: {type: 'container', host: hostId, entry: containerId}, params: true}).then(function (audit) {
                                scope.audit = audit || [];
                                scope.audit.forEach(function (event) {
                                    event.hostName = host.name || host.id;
                                });
                            }, errorCallback);
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
                    }
                };

                var getDockerHost = function () {
                    scope.linkedContainers = null;
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
