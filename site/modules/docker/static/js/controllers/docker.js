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
        'Storage',

        function ($scope, $rootScope, $q, requestContext, localization, $location, Datacenter, Image, PopupDialog, Docker, Account, Storage) {
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
            var tritonEnabled = $rootScope.features.sdcDocker === 'enabled';
            $scope.isTritonTab = tritonEnabled;
            var tritonMachines = [];
            $scope.kvmMachines = [];

            $scope.tabs = tritonEnabled ? ['Triton', 'KVM-Docker'] : ['KVM-Docker'];
            $scope.activeTab = $scope.tabs[0];

            $scope.isChecked = function (tab) {
                return $scope.activeTab === tab;
            };
            $scope.setActive = function (tab) {
                $scope.activeTab = tab;
                $scope.isTritonTab = tritonEnabled ? $scope.activeTab === $scope.tabs[0] : tritonEnabled;
            };

            var errorCallback = function (err) {
                Docker.errorCallback(err, function () {
                    $scope.loading = false;
                });
            };

            $scope.getFilteredMachines = function (machines) {
                return $scope.activeTab === $scope.tabs[0] && tritonEnabled ? tritonMachines : $scope.kvmMachines;
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
                Docker.hostInfo({host: machine, wait: true, suppressErrors: machine.prohibited}, function (error, states) {
                    states.forEach(function (state) {
                        if (state.status) {
                            $scope.states[state.hostId] = state.status;
                        }
                    });
                }).then(function (info) {
                    if (angular.equals(info, {})) {
                        $scope.states[machine.id] = 'unreachable';
                        return;
                    }
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
                    if (machine.prohibited) {
                        return;
                    }
                    Docker.hostUsage({host: machine, wait: true, suppressErrors: true}).then(function (usage) {
                        usage = Array.isArray(usage) ? usage.slice(-1)[0] : usage;
                        machine.cadvisorUnavailable = false;
                        machine.cpuLoad = usage.cpu + '%';
                        machine.memoryLoad = usage.memory + '%';
                    }, function (error) {
                        if (error === 'CAdvisor unavailable') {
                            machine.cadvisorUnavailable = true;
                        }
                    });
                });
            };

            Datacenter.datacenter().then(function (datacenters) {
                $scope.datacenters = datacenters || [];
                $scope.data.datacenter = $scope.datacenters[0].name;
            });

            $q.all([
                $q.when(Docker.listHosts({prohibited: true})),
                Account.getAccount()
            ]).then(function (result) {
                var account = result[1] || {};
                $scope.provisionEnabled = account.provisionEnabled;
                $scope.dockerMachines = [];
                var dockerMachines = result[0] || [];
                if (dockerMachines.length > 0 && $scope.provisionEnabled) {
                    $scope.dockerMachines = dockerMachines.filter(function (machine) {
                        return machine.primaryIp;
                    });
                    Storage.pingManta(function () {
                        $scope.dockerMachines.forEach(function (machine) {
                            if (!machine.prohibited) {
                                getDockerHostInfo(machine);
                            }
                        });
                        getDockerHostAnalytics();
                        Docker.getContainersCount(true).then(function (containers) {
                            $scope.runningContainers = containers.running;
                            $scope.otherContainers = containers.stopped;
                        });
                    });
                }
                $scope.dockerMachines.forEach(function (machine) {
                    if (machine.isSdc) {
                        tritonMachines.push(machine);
                    } else {
                        $scope.kvmMachines.push(machine);
                    }
                });
                $scope.loading = false;
            }, function (err) {
                $scope.loading = false;
                PopupDialog.errorObj(err);
            });

            $scope.$watch('data.datacenter', function (newVal) {
                if (newVal) {
                    $scope.data.imageId = '';
                    Image.image({datacenter: newVal, public: true}).then(function (images) {
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
                if (!machine.isSdc) {
                    $location.url('/compute/instance/' + machine.id);
                }
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

            $scope.createContainer = function () {
                $location.path('/docker/container/create');
            };
        }
    ]);
}(window.JP.getModule('docker')));
