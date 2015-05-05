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
        'util',
        function ($scope, Docker, Machine, PopupDialog, $q, requestContext, localization, $location, $timeout, adviserGraph, util) {
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
            $scope.tabs = ['Summary', 'Infrastructure Summary'];
            $scope.activeTab = $scope.tabs[0];

            var errorCallback = function () {
                $scope.loading = false;
                $scope.actionInProgress = false;
            };

            $scope.graphs = null;
            $scope.actionInProgress = false;
            $scope.loading = true;
            $scope.cadvisorUnavailable = false;

            var updateContainerStats = function (options, callback) {
                if ($scope.container && $scope.container.state !== 'running' && !$scope.actionInProgress) {
                    return;
                }
                if ($scope.machine && $scope.machine.state !== 'running') {
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
                clearInterval(timerUpdateStats);
                if (!start) {
                    return;
                }

                timerUpdateStats = setInterval(function () {
                    if ($scope.machine && $scope.container && $scope.container.infoId && ($location.path() === '/docker/container/' + hostId + '/' + container.Id)) {
                        Docker.inspectContainer(container, {silent: true}).then(function (info) {
                            $scope.container.state = Docker.getContainerState(info);
                        });
                        if (!$scope.machine.isSdc) {
                            updateContainerStats({host: $scope.machine, options: {'num_stats': 2, id: $scope.container.infoId}}, function (error) {
                                if (error === 'CAdvisor unavailable') {
                                    $scope.cadvisorUnavailable = true;
                                    clearInterval(timerUpdateStats);
                                }
                            });
                        }
                    } else {
                        clearInterval(timerUpdateStats);
                    }
                }, 1000);
            };

            var getDockerInspectContainer = function (machine) {
                container.primaryIp = machine.primaryIp;
                container.hostId = machine.id;
                container.isSdc = machine.isSdc;
                $scope.machine = machine;

                Docker.inspectContainer(container).then(function (info) {
                    var containerCmd = info.Config.Cmd;
                    if (Array.isArray(containerCmd)) {
                        containerCmd = info.Config.Cmd.join(' ');
                    }
                    var containerState = Docker.getContainerState(info);
                    $scope.container = {
                        name: info.Name.substring(1),
                        image: info.Config.Image,
                        state: containerState,
                        infoId: info.Id,
                        isSdc: machine.isSdc,
                        Uuid: util.idToUuid(container.Id)
                    };
                    $scope.actionInProgress = false;
                    $scope.loading = false;
                    if (containerState === 'running') {
                        $timeout(function () {
                            statsTimerControl(true);
                        });
                    }
                }, errorCallback);
            };

            var getDockerHost = function () {
                var host = $q.when(Docker.listHosts({id:hostId}));
                host.then(function (machine) {
                    getDockerInspectContainer(machine);
                }, function () {
                    $location.path('/docker/containers');
                });
            };
            getDockerHost();

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
                            getDockerHost();
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
