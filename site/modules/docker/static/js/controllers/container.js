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
        function ($scope, Docker, Machine, PopupDialog, $q, requestContext, localization) {
            localization.bind('docker', $scope);
            requestContext.setUpRenderContext('docker.details', $scope, {
                title: localization.translate(null, 'docker', 'View Joyent Container Details')
            });

            var containerid = requestContext.getParam('containerid');
            var hostid = requestContext.getParam('hostid');

            var errorCallback = function (err) {
                $scope.loading = false;
                PopupDialog.errorObj(err);
            };
            var getDockerInspectContainer = function () {
                var machine = $q.when(Machine.machine(hostid));
                machine.then(function (machine) {
                    Docker.inspectContainer(machine, containerid).then(function (info) {
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
                    }, errorCallback);
                    Docker.getContainerLogs(machine, containerid).then(function (logs) {
                        $scope.containerLogs = [];
                        logs = logs.split(/[\r\n]+/);
                        function deleteTimeStamps(str) {
                            return str.replace(str.substr(0, str.indexOf('Z ', 1)) + 'Z ', '');
                        }
                        if (Array.isArray(logs)) {
                            logs.forEach(function (str) {
                                $scope.containerLogs.push(deleteTimeStamps(str));
                            });
                        } else {
                            $scope.containerLogs.push(deleteTimeStamps(logs));
                        }
                    }, errorCallback);
                });
            };
            getDockerInspectContainer();
        }
    ]);
}(window.JP.getModule('docker')));