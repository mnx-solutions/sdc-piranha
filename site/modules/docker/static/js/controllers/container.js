'use strict';

(function (app) {
    app.controller('Container.DetailsController', [
        '$scope',
        'Docker',
        'Machine',
        'PopupDialog',
        '$q',
        'requestContext',
        'localization',
        '$location',
        function ($scope, Docker, Machine, PopupDialog, $q, requestContext, localization, $location) {
            localization.bind('docker', $scope);
            requestContext.setUpRenderContext('docker.details', $scope, {
                title: localization.translate(null, 'docker', 'View Joyent Container Details')
            });

            var containerId = requestContext.getParam('containerid');
            var hostid = requestContext.getParam('hostid');
            var container = {
                Id: containerId
            };

            $scope.loading = true;
            $scope.actionInProgress = false;

            var errorCallback = function (err) {
                $scope.loading = false;
                $scope.actionInProgress = false;
                PopupDialog.errorObj(err);
            };

            function deleteTimeStamps(str) {
                var charArray = ['Z', ']'];
                charArray.some(function (char) {
                    if (str.indexOf(char + ' ', 1) > 0) {
                        return str = str.replace(str.substr(0, str.indexOf(char + ' ', 1)) + char + ' ', '');
                    }
                });
                return str;
            }

            var getDockerInspectContainer = function () {
                var machine = $q.when(Machine.machine(hostid));
                machine.then(function (machine) {
                    container.primaryIp = machine.primaryIp;
                    Docker.inspectContainer(container).then(function (info) {
                        var containerCmd = info.Config.Cmd;
                        var containerState = 'stopped';
                        if (Array.isArray(containerCmd)) {
                            containerCmd = info.Config.Cmd.join(' ');
                        }
                        if (info.State.Paused) {
                            containerState = 'paused';
                        } else if (info.State.Restarting) {
                            containerState = 'restarting';
                        } else if (info.State.Running) {
                            containerState = 'running';
                        }
                        $scope.container = {
                            name: info.Name,
                            cmd: containerCmd,
                            entrypoint: info.Config.Entrypoint,
                            ports: info.Config.ExposedPorts,
                            hostname: info.Config.Hostname,
                            image: info.Config.Image,
                            memory: info.Config.Memory,
                            cpuShares: info.Config.CpuShares,
                            created: info.Created,
                            state: containerState
                        };
                        $scope.actionInProgress = false;
                    }, errorCallback);
                    Docker.logsContainer(container).then(function (logs) {
                        $scope.containerLogs = [];
                        if (logs && typeof (logs) === 'string') {
                            logs = logs.split(/[\r\n]+/);
                            if (Array.isArray(logs)) {
                                logs.forEach(function (str) {
                                    $scope.containerLogs.push(deleteTimeStamps(str));
                                });
                            } else {
                                $scope.containerLogs.push(deleteTimeStamps(logs));
                            }
                        }
                    }, errorCallback);
                }, function () {
                    $location.path('/docker/containers');
                });
            };
            getDockerInspectContainer();

            $scope.makeContainerAction = function (action) {
                $scope.actionInProgress = true;
                Docker[action + 'Container'](container).then(function () {
                    if (action === 'remove') {
                        $location.path('/docker/containers');
                    } else {
                        getDockerInspectContainer();
                    }
                }, errorCallback);
            }
        }
    ]);
}(window.JP.getModule('docker')));