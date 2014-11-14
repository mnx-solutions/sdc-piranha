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
        'Account',

        function ($scope, $rootScope, $q, requestContext, localization, $location, Datacenter, Image, PopupDialog, Docker, Account) {
            localization.bind('docker.index', $scope);
            requestContext.setUpRenderContext('docker.index', $scope, {
                title: localization.translate(null, 'docker', 'See my Joyent Docker Instances')
            });

            var UBUNTU_IMAGE_NAME = 'ubuntu-certified-14.04';

            $scope.loading = true;
            $scope.states = {};
            $scope.data = {
                datacenter: '',
                imageId: ''
            };

            var errorCallback = function (err) {
                Docker.errorCallback(err, function () {
                    $scope.loading = false;
                });
            };

            function getHostImagesCount(machine) {
                Docker.listImages(machine).then(function (images) {
                    machine.imagesCount = images.length;
                }, function (err) {
                    PopupDialog.errorObj(err);
                });
            }

            var getDockerHostInfo = function (machine) {
                $scope.states[machine.id] = 'initializing';
                Docker.hostInfo({host: machine, wait: true}, function (error, state) {
                    $scope.states[state.hostId] = state.status;
                }).then(function (info) {
                    info = Array.isArray(info) ? info.slice(-1)[0] : info;
                    $scope.states[machine.id] = 'completed';
                    machine.containersCount = info.Containers;
                    getHostImagesCount(machine);
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

            Datacenter.datacenter().then(function (datacenters) {
                $scope.datacenters = datacenters || [];
                $scope.data.datacenter = $scope.datacenters[0].name;
            });

            Docker.listHosts().then(function (dockerMachines) {
                if (dockerMachines.length > 0) {
                    $scope.dockerMachines = dockerMachines.filter(function (machine) {
                        return machine.primaryIp;
                    });
                    Docker.pingManta(function () {
                        $scope.dockerMachines.forEach(function (machine) {
                            getDockerHostInfo(machine);
                        });
                        getDockerHostAnalytics();
                    });
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
                            return image.name.indexOf(UBUNTU_IMAGE_NAME) !== -1;
                        });
                        if (ubuntuImages.length > 0) {
                            ubuntuImages.sort(function (a, b) {
                                return -a.version.localeCompare(b.version);
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

            $scope.completeAccount = function () {
                Account.checkProvisioning({btnTitle: 'Submit and Access Docker'}, null, null, function () {
                    $location.path('/docker');
                }, false);
            };
        }
    ]);
}(window.JP.getModule('docker')));
