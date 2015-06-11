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
            var statsSocket;
            var inspectInterval;

            $scope.tabs = ['Docker Details', 'Infrastructure Details'];
            $scope.activeTab = $scope.tabs[0];

            var errorCallback = function () {
                $scope.loading = false;
                $scope.actionInProgress = false;
            };

            $scope.graphs = null;
            $scope.actionInProgress = false;
            $scope.loading = true;
            $scope.cadvisorUnavailable = false;

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

            var getDockerInspectContainer = function (machine) {
                container.primaryIp = machine.primaryIp;
                container.hostId = machine.id;
                container.isSdc = machine.isSdc;
                $scope.machine = machine;
                inspectInterval = setInterval(function () {
                    Docker.inspectContainer(container, {silent: true}).then(function (info) {
                        $scope.container.state = Docker.getContainerState(info);
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
                if (inspectInterval) {
                    clearInterval(inspectInterval);
                }
            });
        }
    ]);
}(window.JP.getModule('docker')));
