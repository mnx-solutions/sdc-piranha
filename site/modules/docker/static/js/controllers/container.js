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
        '$timeout',
        'adviserGraph',
        function ($scope, Docker, Machine, PopupDialog, $q, requestContext, localization, $location, $timeout, adviserGraph) {
            localization.bind('docker', $scope);
            requestContext.setUpRenderContext('docker.details', $scope, {
                title: localization.translate(null, 'docker', 'View Joyent Container Details')
            });

            var containerId = requestContext.getParam('containerid');
            var hostId = requestContext.getParam('hostid');
            var container = {
                Id: containerId
            };
            var timerUpdateStats = 0;

            $scope.graphs = null;
            $scope.loading = true;
            $scope.actionInProgress = false;
            $scope.loading = true;
            $scope.cadvisorUnavailable = false;

            var errorCallback = function (err) {
                $scope.loading = false;
                $scope.actionInProgress = false;
                PopupDialog.errorObj(err);
            };

            var updateContainerStats = function (options, callback) {
                if ($scope.container && $scope.container.state !== 'running' && !$scope.actionInProgress) {
                    return;
                }
                callback = callback || angular.noop;
                $scope.graphs = $scope.graphs || adviserGraph.init();
                Docker.containerUtilization(options).then(function (containerStats) {
                    if (containerStats.spec && containerStats.stats && containerStats.stats.length) {
                        $scope.graphs = adviserGraph.updateValues($scope.graphs, containerStats);
                    }
                    callback();
                }, function (err) {
                    if (!$scope.actionInProgress && $scope.container.state !== 'running' && $scope.container.state !== 'stopped') {
                        PopupDialog.errorObj(err);
                    }
                    callback(err);
                });
            };

            var statsTimerControl = function (start) {
                if (!start) {
                    clearInterval(timerUpdateStats);
                    return;
                }

                timerUpdateStats = setInterval(function () {
                    if ($scope.machine && $scope.container && $scope.container.infoId && ($location.path() === '/docker/container/' + hostId + '/' + container.Id)) {
                        updateContainerStats({host: $scope.machine, options: {num_stats: 2, id: $scope.container.infoId}}, function (error) {
                            if (error === 'CAdvisor unavailable') {
                                $scope.cadvisorUnavailable = true;
                                clearInterval(timerUpdateStats);
                            }
                        });
                    } else {
                        clearInterval(timerUpdateStats);
                    }
                }, 1000);
            };

            var getDockerInspectContainer = function () {
                var machine = $q.when(Machine.machine(hostId));
                machine.then(function (machine) {
                    container.primaryIp = machine.primaryIp;
                    container.hostId = machine.id;
                    $scope.machine = machine;
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
                            infoId: info.Id
                        };
                        $scope.actionInProgress = false;
                        $scope.loading = false;
                        if (containerState === 'running') {
                            $timeout(function () {
                                statsTimerControl(true);
                            });
                        }
                    }, errorCallback);
                    Docker.logsContainer(container).then(function (logs) {
                        $scope.containerLogs = [];
                        if (logs && typeof (logs) === 'string') {
                            logs = logs.split(/[\r\n]+/);
                            if (Array.isArray(logs)) {
                                logs.forEach(function (str) {
                                    $scope.containerLogs.push(str);
                                });
                            } else {
                                $scope.containerLogs.push(logs);
                            }
                        }
                    }, errorCallback);
                    Docker.getAuditInfo({event: {type: 'container', host: hostId, entry: containerId}, params: true}).then(function(info) {
                        $scope.audit = info || [];
                    }, errorCallback);
                }, function () {
                    $location.path('/docker/containers');
                });
            };
            getDockerInspectContainer();

            function capitalize(string) {
                return string.charAt(0).toUpperCase() + string.slice(1);
            }

            $scope.makeContainerAction = function (action) {
                function doAction() {
                    $scope.actionInProgress = true;
                    statsTimerControl(false);
                    if (action === 'remove') {
                        container.Image = $scope.container.image;
                        container.Names = [$scope.container.name];
                        container.hostId = $scope.machine.id;
                        container.hostName = $scope.machine.name;
                        container.force = true;
                    }
                    Docker[action + 'Container'](container).then(function () {
                        if (action === 'remove') {
                            $location.path('/docker/containers');
                        } else {
                            getDockerInspectContainer();
                        }
                    }, errorCallback);
                }

                if ($scope.container.name === 'cAdvisor' && ['stop', 'pause', 'kill', 'remove'].indexOf(action) !== -1) {
                    PopupDialog.confirm(
                        'Please confirm that you want to ' + action + ' this container.',
                        'Docker analytics will be unavailable. Are you sure you want to ' + action + ' it?',
                        doAction
                    );
                } else {
                    PopupDialog.confirm(
                        localization.translate(
                            $scope,
                            null,
                            'Confirm: ' + capitalize(action) + ' container'
                        ),
                        localization.translate(
                            $scope,
                            null,
                            'Please confirm that you want to ' + action + ' this container.'
                        ),
                        doAction
                    );
                }
            };
        }
    ]);
}(window.JP.getModule('docker')));
