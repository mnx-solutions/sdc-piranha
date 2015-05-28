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
        'CloudAnalytics',

        function ($scope, $rootScope, $q, requestContext, localization, $location, Datacenter, Image, PopupDialog, Docker, Account, Storage, CloudAnalytics) {
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
            $scope.chartOptions = {
                size: 60
            };
            var tritonEnabled = $rootScope.features.sdcDocker === 'enabled';
            $scope.isTritonTab = tritonEnabled;
            var tritonMachines = [];
            $scope.kvmMachines = [];

            $scope.tabs = tritonEnabled ? ['Triton Docker Hosts', 'KVM-Docker Hosts'] : ['KVM-Docker Hosts'];
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

            var loadMachineAnalytics = function (machine, retries) {
                if (!retries) {
                    return PopupDialog.errorObj(new Error('Error retrieving host analytics'));
                }

                CloudAnalytics.getValues({
                    zoneId: machine.id,
                    datacenter: $scope.data.datacenter,
                    get start() {
                        return Math.floor(new Date() / 1000) - 30;
                    }
                }, function (err, value) {
                    function retry () {
                        setTimeout(function () {loadMachineAnalytics(machine, retries - 1)}, 1000);
                    }

                    try {
                        var memoryData = [value[0].value.value, value[1].value.value];
                        memoryData.sort();
                        machine.memoryLoad = Math.round((memoryData[0] / memoryData[1]) * 100);
                        if (!machine.memoryLoad) {
                            return retry();
                        }
                    } catch (ex) {
                        return retry();
                    }
                });
            };

            var getDockerHostAnalytics = function () {
                $scope.dockerMachines.forEach(function (machine) {
                    if (machine.prohibited || machine.isSdc) {
                        return;
                    }
                    CloudAnalytics.describeAndCreateInstrumentation({
                        datacenter: $scope.data.datacenter,
                        zoneId: machine.id,
                        configs: ['memory']
                    }, function (err, data) {
                        if (err) {
                            return PopupDialog.errorObj(err);
                        }
                        loadMachineAnalytics(machine, 10);
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

            $scope.createContainer = function (machine) {
                $location.path('/docker/container/create/' + machine.id);
            };
        }
    ]);
}(window.JP.getModule('docker')));
