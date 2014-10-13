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
        function ($scope, Docker, Machine, PopupDialog, $q, requestContext, localization, $location, $timeout) {
            localization.bind('docker', $scope);
            requestContext.setUpRenderContext('docker.details', $scope, {
                title: localization.translate(null, 'docker', 'View Joyent Container Details')
            });

            var containerId = requestContext.getParam('containerid');
            var hostid = requestContext.getParam('hostid');
            var container = {
                Id: containerId
            };
            var timerUpdateStats = 0;

            $scope.graphs = null;
            $scope.loading = true;
            $scope.actionInProgress = false;
            $scope.loading = true;

            var errorCallback = function (err) {
                $scope.loading = false;
                $scope.actionInProgress = false;
                PopupDialog.errorObj(err);
            };

            function getInterval(current, previous) {
                // ms -> ns.
                return (new Date(current).getTime() - new Date(previous).getTime()) * 1000000;
            }

            function hasResource(containerStats, resource) {
                return containerStats.stats.length > 0 && containerStats.stats[0][resource];
            }

            function drawCpuTotalUsage(containerStats) {
                if (containerStats.spec.has_cpu && !hasResource(containerStats, 'cpu')) {
                    return;
                }

                var data = [];
                var usageTotal = [];
                for (var i = 1; i < containerStats.stats.length; i++) {
                    var cur = containerStats.stats[i];
                    var prev = containerStats.stats[i - 1];
                    var intervalInNs = getInterval(cur.timestamp, prev.timestamp);

                    usageTotal.push({x: i, y: (cur.cpu.usage.total - prev.cpu.usage.total) / intervalInNs});
                }
                data.push(usageTotal);
                return data;
            }

            function drawMemoryUsage(containerStats) {
                if (containerStats.spec.has_memory && !hasResource(containerStats, 'memory')) {
                    return;
                }

                var data = [];
                var memoryUsage = [];
                var memoryWorking = [];
                for (var i = 0; i < containerStats.stats.length; i++) {
                    var cur = containerStats.stats[i];
                    memoryUsage.push({x: i, y: cur.memory.usage});
                    memoryWorking.push({x: i, y: cur.memory.working_set});
                }
                data.push(memoryUsage);
                data.push(memoryWorking);
                return data;
            }

            function drawNetworkBytes(containerStats) {
                if (containerStats.spec.has_network && !hasResource(containerStats, 'network')) {
                    return;
                }

                var data = [];
                var txBytes = [];
                var rxBytes = [];
                for (var i = 1; i < containerStats.stats.length; i++) {
                    var cur = containerStats.stats[i];
                    var prev = containerStats.stats[i - 1];
                    var intervalInSec = getInterval(cur.timestamp, prev.timestamp) / 1000000000;

                    txBytes.push({x: i, y: (cur.network.tx_bytes - prev.network.tx_bytes) / intervalInSec});
                    rxBytes.push({x: i, y: (cur.network.rx_bytes - prev.network.rx_bytes) / intervalInSec});
                }
                data.push(txBytes);
                data.push(rxBytes);
                return data;
            }

            function deleteTimeStamps(str) {
                return str.replace(str.substr(0, 8), '');
            }
            $scope.cpu = {};
            $scope.cpu.data = [];
            $scope.cpu.options = {
                type: {
                    abbr: '%',
                    power: 1
                },
                title: 'CPU: total usage',
                legends: ['aggregated CPU usage'],
                colors: ['#78959B']
            };
            $scope.memory = {};
            $scope.memory.data = [];
            $scope.memory.options = {
                type: {
                    arity: 'numeric',
                    unit: 'bytes',
                    abbr: 'B',
                    base: 2,
                    name: 'size'
                },
                title: 'Memory usage',
                legends: ['current memory usage', 'memory working set'],
                colors: ['#cb513a', '#73c03a']
            };
            $scope.network = {};
            $scope.network.data = [];
            $scope.network.options = {
                type: {
                    arity: 'numeric',
                    unit: 'bytes',
                    abbr: 'B',
                    base: 2,
                    name: 'size'
                },
                title: 'Network tx/rx',
                legends: ['Tx', 'Rx'],
                colors: ['#398D62', '#78959B']
            };

            var updateStats = function (name, stats) {
                if (!stats) {
                    return;
                }
                var statsObject = $scope[name];
                if (statsObject.data.length === 0) {
                    var chartsArray = [];
                    stats.forEach(function (stat, index) {
                        chartsArray[index] = [];
                        for (var i = 0; i < 60; i++) {
                            chartsArray[index].push({x: i, y: 0});
                        }
                    });
                    statsObject.data = chartsArray;
                } else {
                    stats.forEach(function (stat, index) {
                        var arrayWithCurrentData = $scope[name].data[index];
                        var newStatsData = stat[stat.length - 1];
                        var lastXAxisPosition = arrayWithCurrentData[arrayWithCurrentData.length - 1].x;
                        arrayWithCurrentData.shift();
                        newStatsData.x = lastXAxisPosition + 1;
                        arrayWithCurrentData.push(newStatsData);
                    });
                }
            };
            var updateContainerStats = function (machine, id, statsSeconds) {
                if ($scope.container && $scope.container.state != 'running' && !$scope.actionInProgress) {
                    return;
                }
                Docker.containerUtilization(machine, id, statsSeconds).then(function (containerStats) {
                    if (containerStats.spec && containerStats.stats && containerStats.stats.length) {
                        updateStats('cpu', drawCpuTotalUsage(containerStats));
                        updateStats('memory', drawMemoryUsage(containerStats));
                        updateStats('network', drawNetworkBytes(containerStats));
                    }
                }, function (err) {
                    if (!$scope.actionInProgress && $scope.container.state != 'running' && $scope.container.state != 'stopped') {
                        PopupDialog.errorObj(err);
                    }
                });
            };

            var statsTimerControl = function (start) {
                if (start) {
                    timerUpdateStats = setInterval(function () {
                        if ($scope.machine && $scope.container && $scope.container.infoId && ($location.path() == '/docker/container/' + hostid + '/' + container.Id)) {
                            updateContainerStats($scope.machine, $scope.container.infoId, 1);
                        } else {
                            clearInterval(timerUpdateStats);
                        }
                    }, 1000);
                } else {
                    clearInterval(timerUpdateStats);
                }
            };

            var getDockerInspectContainer = function () {
                var machine = $q.when(Machine.machine(hostid));
                machine.then(function (machine) {
                    container.primaryIp = machine.primaryIp;
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
                            name: info.Name,
                            cmd: containerCmd,
                            entrypoint: info.Config.Entrypoint,
                            ports: info.Config.ExposedPorts,
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
                statsTimerControl(false);
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