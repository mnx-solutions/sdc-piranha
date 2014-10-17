'use strict';

(function (app) {
    app.controller('Docker.IndexController', [
        '$scope',
        '$rootScope',
        '$q',
        'requestContext',
        'localization',
        '$location',
        'Datacenter',
        'Image',
        'PopupDialog',
        'Docker',

        function ($scope, $rootScope, $q, requestContext, localization, $location, Datacenter, Image, PopupDialog, Docker) {
            localization.bind('docker.index', $scope);
            requestContext.setUpRenderContext('docker.index', $scope, {
                title: localization.translate(null, 'docker', 'See my Joyent Docker Instances')
            });

            $scope.loading = true;
            $scope.states = {};
            $scope.data = {
                datacenter: '',
                imageId: ''
            };

            var errorCallback = function (err) {
                $scope.loading = false;
                PopupDialog.errorObj(err);
            };
            var getDockerHostInfo = function (machine, images) {
                $scope.states[machine.id] = 'initializing';
                Docker.hostInfo({host: machine, wait: true}, function (error, state) {
                    $scope.states[state.hostId] = state.status;
                }).then(function (info) {
                    var imagesCount = 0;
                    info = Array.isArray(info) ? info.slice(-1)[0] : info;
                    $scope.states[machine.id] = 'completed';
                    if (images.length > 0) {
                        imagesCount = images.filter(function (image) {
                            return machine.id === image.hostId;
                        }).length;
                    }
                    machine.containersCount = info.Containers;
                    machine.imagesCount = imagesCount;
                }, function () {
                    $scope.states[machine.id] = 'unreachable';
                    errorCallback.apply(this, arguments);
                });
            };

            var getDockerHostAnalytics = function () {
                $scope.dockerMachines.forEach(function (machine) {
                    Docker.hostUsage({host: machine, wait: true}).then(function (usage) {
                        usage = Array.isArray(usage) ? usage.slice(-1)[0] : usage;
                        machine.cpuLoad = usage.cpu + '%';
                        machine.memoryLoad = usage.memory + '%';
                    });
                });
            };

            $q.all([
                $q.when(Datacenter.datacenter()),
                $q.when(Docker.listHosts()),
                $q.when(Docker.listAllImages())
            ]).then(function (result) {
                $scope.datacenters = result[0] || [];
                $scope.data.datacenter = $scope.datacenters[0].name;
                $scope.dockerMachines = [];
                var dockerMachines = result[1] || [];
                $scope.dockerImages = result[2] || [];
                if (dockerMachines.length > 0) {
                    dockerMachines.forEach(function (machine) {
                        if (machine.primaryIp) {
                            $scope.dockerMachines.push(machine);
                            getDockerHostInfo(machine, $scope.dockerImages);
                        }
                    });
                    getDockerHostAnalytics();
                }
                $scope.loading = false;
            }, function (err) {
                $scope.loading = false;
                PopupDialog.errorObj(err);
            });

            $scope.$watch('data.datacenter', function (newVal) {
                if (newVal) {
                    $scope.data.imageId = '';
                    Image.image({ datacenter: newVal, public: true }).then(function (images) {
                        var ubuntuImages = images.filter(function (image) {
                            return image.name.indexOf('ubuntu') !== -1;
                        });
                        if (ubuntuImages.length > 0) {
                            ubuntuImages.sort(function (a, b) {
                                return -a.name.localeCompare(b.name);
                            });
                            $scope.data.imageId = ubuntuImages[0].id;
                        } else {
                            PopupDialog.message(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Message'
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    'This datacenter has no “ubuntu” image suitable for creating docker host'
                                )
                            );
                        }
                    }, function (err) {
                        PopupDialog.errorObj(err);
                    });
                }
            });

            $scope.navigateMachine = function (machine) {
                $location.url('/compute/instance/' + machine.id);
            };

            $scope.navigateContainersImages = function (route, host) {
                $location.url('/docker/' + route + '?host=' + host);
            };

            $scope.createDocker = function () {
                $rootScope.commonConfig('datacenter', $scope.data.datacenter);
                $location.url('/compute/create/' + $scope.data.imageId + '?specification=dockerhost');
            };
        }
    ]);
}(window.JP.getModule('docker')));
