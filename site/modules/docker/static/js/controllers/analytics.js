'use strict';

(function (ng, app) {
    app.controller('Docker.AnalyticsController', [
        '$scope',
        'Docker',
        'adviserGraph',
        'PopupDialog',
        '$q',
        'requestContext',
        'localization',
        '$location',
        function ($scope, Docker, adviserGraph, PopupDialog, $q, requestContext, localization, $location) {
            localization.bind('docker', $scope);
            requestContext.setUpRenderContext('docker.analytics', $scope, {
                title: localization.translate(null, 'docker', 'Docker Analytics')
            });

            var containerId = requestContext.getParam('containerid');
            var hostId = requestContext.getParam('hostid');
            var containerAnalysys = null;
            var hostAnalysys = null;
            $scope.cadvisorUnavailable = false;

            $scope.hostId = hostId;
            $scope.current = {
                host: '',
                hostName: '',
                container: '',
                containerNames: '',
                metric: ''
            };

            var networkMetrics = [
                {name: 'Network: bytes', val: 'network'},
                {name: 'Network: packets', val: 'networkPackets'},
                {name: 'Network: errors', val: 'networkErrors'}
            ];

            var hostMetrics = [
                {name: 'CPU: Total', val: 'cpuTotal'},
                {name: 'CPU: Breakdown', val: 'cpuBreakdown'},
                {name: 'Memory', val: 'memory'}
            ];
            var timerUpdateStats = 0;

            var errorCallback = function (err) {
                Docker.errorCallback(err, function () {
                    $scope.changingHost = false;
                });
            };

            Docker.pingManta(function () {
                Docker.listHosts().then(function (hosts) {
                    $scope.hosts = hosts || [];
                    if (hostId) {
                        $scope.hosts.forEach(function (host) {
                            if (hostId === host.id) {
                                $scope.current.host = host.primaryIp;
                                $scope.current.hostName = host.name;
                                $scope.changeHost();
                            }
                        });
                    }
                });
            });

            $scope.changeHost = function () {
                $scope.changingHost = true;
                $scope.cadvisorUnavailable = false;
                $scope.containers = [];
                $scope.hosts.forEach(function (host) {
                    if ($scope.current.host === host.primaryIp && $scope.hostId !== host.id) {
                        $scope.hostId = host.id;
                        $scope.current.hostName = host.name;
                        $location.path('/docker/analytics/' + host.id);
                    }
                });
                $scope.metrics = hostMetrics;
                $scope.defaultMetrics = ['cpuTotal', 'memory'];
                Docker.listContainers({host: {primaryIp: $scope.current.host, id: $scope.hostId}}).then(function (containers) {
                    var isRunningCAdvisor = containers.filter(function (container) {
                       return container.name === '/cAdvisor' && container.Status.indexOf('Paused') === -1;
                    });

                    if (!isRunningCAdvisor) {
                        $scope.changingHost = false;
                        return;
                    }
                    $scope.containers = containers.filter(function (container) {
                        return container.Status.indexOf('Paused') === -1;
                    });
                    if (containerId) {
                        $scope.containers.forEach(function (container) {
                            if (containerId === container.Id) {
                                $scope.current.container = containerId;
                                $scope.current.containerNames = container.NamesStr;
                                $scope.metrics = hostMetrics.concat(networkMetrics);
                                $scope.defaultMetrics = ['cpuTotal', 'memory', 'network'];
                            }
                        });
                    }
                    $scope.changingHost = false;
                }, errorCallback);
            };

            $scope.changeContainer = function () {
                if ($scope.current.container !== containerId) {
                    containerId = $scope.current.container;
                    $location.path('/docker/analytics/' + $scope.hostId + '/' + containerId);
                }
                if ($scope.current.container) {
                    $scope.metrics = hostMetrics.concat(networkMetrics);
                    $scope.defaultMetrics = ['cpuTotal', 'memory', 'network'];
                    $scope.current.containerNames = $scope.containers.filter(function (container) {
                        return containerId === container.Id;
                    })[0].NamesStr;
                } else {
                    $scope.metrics = hostMetrics;
                    $scope.defaultMetrics = ['cpuTotal', 'memory'];
                }
            };

            var updateContainerStats = function (data, id, callback) {
                if (id) {
                    data.options.id = id;
                }
                if (id !== containerAnalysys || data.host.primaryIp !== hostAnalysys) {
                    return false;
                }
                Docker[id ? 'containerUtilization' : 'hostUtilization'](data).then(function (containerStats) {
                    if (containerStats.spec && containerStats.stats && containerStats.stats.length && $scope.canDelete()) {
                       if (id === containerAnalysys && data.host.primaryIp === hostAnalysys) {
                            $scope.graphs = adviserGraph.updateValues($scope.graphs, containerStats);
                       }
                    }
                    callback();
                }, function (err) {
                    callback(err);
                });
            };

            var clearGraphs = function () {
                $scope.deleted = true;
                clearInterval(timerUpdateStats);
                timerUpdateStats = 0;
                $scope.graphs = null;
                $scope.deleted = false;
            };

            var statsTimerControl = function () {
                if (timerUpdateStats && $scope.graphs) {
                    clearGraphs();
                }
                containerAnalysys = $scope.current.container;
                hostAnalysys = $scope.current.host;
                timerUpdateStats = setInterval(function () {
                    if ($scope.current.host && ($location.path().search('/docker/analytics') !== -1) && !$scope.deleted && $scope.canDelete()) {
                        updateContainerStats({host: {primaryIp: $scope.current.host, state: 'running'}, options: {num_stats: 2}}, $scope.current.container, function (error) {
                            if (error === 'CAdvisor unavailable') {
                                clearGraphs();
                                $scope.cadvisorUnavailable = true;
                                return;
                            }
                        });
                    } else {
                        clearGraphs();
                    }
                }, 1000);
            };


            $scope.createDefault = function () {
                $scope.cadvisorUnavailable = false;
                if (timerUpdateStats && (containerAnalysys !== $scope.current.container || hostAnalysys !== $scope.current.host)) {
                    containerAnalysys = $scope.current.container;
                    hostAnalysys = $scope.current.host;
                    clearGraphs();
                    setTimeout($scope.createDefault);
                    return;
                }

                if (!timerUpdateStats) {
                    $scope.graphs = adviserGraph.init($scope.defaultMetrics);
                    statsTimerControl();
                } else {
                    $scope.defaultMetrics.forEach(function (metric) {
                        if (metric && !$scope.graphs[metric]) {
                            $scope.graphs = ng.extend($scope.graphs, adviserGraph.init([metric]));
                        }
                    });
                }
            };

            $scope.deleteAll = function () {
                clearGraphs();
            };

            $scope.create = function () {
                if (timerUpdateStats && (containerAnalysys !== $scope.current.container || hostAnalysys !== $scope.current.host)) {
                    containerAnalysys = $scope.current.container;
                    hostAnalysys = $scope.current.host;
                    clearGraphs();
                    setTimeout($scope.create);
                    return;
                }
                var metric = $scope.current.metric;
                $scope.graphs = $scope.graphs || {};
                if (metric && !$scope.graphs[metric]) {
                    $scope.graphs = ng.extend($scope.graphs, adviserGraph.init([metric]));
                }
                if (!timerUpdateStats) {
                    statsTimerControl();
                }
            };

            $scope.canDelete = function () {
                return $scope.graphs && Object.keys($scope.graphs).length;
            };
        }
    ]);
}(window.angular, window.JP.getModule('docker')));