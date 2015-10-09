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
                title: localization.translate(null, 'docker', 'View ' + $scope.companyName + ' Container Details')
            });

            var containerId = requestContext.getParam('containerid');
            var hostId = requestContext.getParam('hostid');
            var container = {
                Id: containerId
            };
            var timerUpdateStats = 0;
            var statsSocket;
            var inspectInterval;
            $scope.goTo = function (linkedContainer) {
                $scope.loading = true;
                containerId = linkedContainer.id;
                hostId = linkedContainer.hostId;
                container = {
                    Id: containerId
                };
                $location.path('/docker/container/' + hostId + '/' + containerId);
                init();
                getDockerHost();
            };

            $scope.tabs = ['Docker Details', 'Infrastructure Details'];
            $scope.activeTab = $scope.tabs[0];

            var errorCallback = function () {
                $scope.loading = false;
                $scope.actionInProgress = false;
            };

            var init = function () {
                $scope.graphs = null;
                $scope.actionInProgress = false;
                $scope.loading = true;
                $scope.cadvisorUnavailable = false;
            };

            init();
            var updateContainerStats = function (stats) {
                if ($scope.container && $scope.container.state !== 'running' && !$scope.actionInProgress ||
                    $scope.machine && $scope.machine.state !== 'running') {
                    return;
                }

                $scope.graphs = $scope.graphs || adviserGraph.init();
                $scope.graphs = adviserGraph.updateValues($scope.graphs, {stats: [stats]});

                var phase = $scope.$root && $scope.$root.$$phase;
                if (phase !== '$apply' && phase !== '$digest') {
                    $scope.$apply();
                }
            };

            var clearInspectInterval = function () {
                if (inspectInterval) {
                    clearInterval(inspectInterval);
                }
            };

            var getDockerInspectContainer = function (machine) {
                if ($scope.destroyed) {
                    return;
                }
                container.primaryIp = machine.primaryIp;
                container.hostId = machine.id;
                container.isSdc = machine.isSdc;
                $scope.machine = machine;
                clearInspectInterval();
                if ($scope.machine.state === 'deleting') {
                    return Docker.goToDockerContainers();
                }
                inspectInterval = setInterval(function () {
                    if ($scope.container && $scope.container.isRemoving) {
                        return;
                    }
                    $timeout(function () {
                        if (container.Id && container.hostId && container.primaryIp) {
                            Docker.inspectContainer(container, {silent: true}).then(function (info) {
                                $scope.container.state = Docker.getContainerState(info);
                            });
                        }
                    });
                }, 5000);
                Docker.inspectContainer(container).then(function (info) {
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
                    if (!machine.isSdc) {
                        statsSocket = Docker.getContainerStats({host: machine, containerId: container.Id}, updateContainerStats);
                    }
                }, errorCallback);
            };

            var getDockerHost = function () {
                var host = $q.when(Docker.listHosts({id:hostId}));
                host.then(function (machine) {
                    if (machine.isSdc) {
                        $q.all([
                            Docker.listContainers({host: 'All', cache: true, options: {all: true}, suppressErrors: true}),
                            Machine.machine(util.idToUuid(containerId))
                        ]).then(function (result) {
                            var containers = result[0] || [];
                            var sdcInstance = result[1];
                            var container = containers.find(function (container) {
                                return container.primaryIp === machine.primaryIp;
                            });
                            if (container && sdcInstance) {
                                machine.state = sdcInstance.state;
                            } else {
                                machine.state = 'deleting';
                            }
                            getDockerInspectContainer(machine);
                        }, Docker.goToDockerContainers);
                        return;
                    }
                    getDockerInspectContainer(machine);
                }, Docker.goToDockerContainers);
            };
            getDockerHost();

            function capitalize(string) {
                return string.charAt(0).toUpperCase() + string.slice(1);
            }

            $scope.makeContainerAction = function (action) {
                function doAction() {
                    $scope.actionInProgress = true;
                    if (action === 'remove') {
                        $scope.container.isRemoving = true;
                        container.Image = $scope.container.image;
                        container.Names = [$scope.container.name];
                        container.hostId = $scope.machine.id;
                        container.hostName = $scope.machine.name;
                        container.force = true;
                    }
                    Docker[action + 'Container'](container).then(function () {
                        if (action === 'remove') {
                            Docker.goToDockerContainers();
                        } else {
                            getDockerHost();
                        }
                    }, function () {
                        if (action === 'remove') {
                            delete $scope.container.isRemoving;
                        }
                        errorCallback();
                    });
                }

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
            };

            $scope.$on('$destroy', function () {
                if (statsSocket) {
                    statsSocket.close();
                }
                clearInspectInterval();
                $scope.destroyed = true;
            });
        }
    ]);
}(window.JP.getModule('docker')));
