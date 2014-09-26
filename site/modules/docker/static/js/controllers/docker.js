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
            $scope.data = {
                datacenter: '',
                imageId: ''
            };

            var errorCallback = function (err) {
                $scope.loading = false;
                PopupDialog.errorObj(err);
            };
            var getDockerHostInfo = function (machine) {
                Docker.hostInfo(machine).then(function (info) {
                    machine.containersCount = info.Containers;
                    machine.imagesCount = info.Images;
                }, errorCallback);
            };
            var getDockerHostAnalytics = function () {
                //TODO: Get real data from cAdvisor
                $scope.dockerMachines.forEach(function (machine) {
                    machine.cpuLoad = '35%';
                    machine.memoryLoad = '85%';
                });
            };

            $q.all([
                $q.when(Datacenter.datacenter()),
                $q.when(Docker.listHosts())
            ]).then(function (result) {
                $scope.datacenters = result[0] || [];
                $scope.data.datacenter = $scope.datacenters[0].name;
                $scope.dockerMachines = result[1] || [];
                if ($scope.dockerMachines.length > 0) {
                    $scope.dockerMachines.forEach(function (machine) {
                        if (machine.primaryIp) {
                            getDockerHostInfo(machine);
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

            $scope.createDocker = function () {
                $rootScope.commonConfig('datacenter', $scope.data.datacenter);
                $location.url('/compute/create/' + $scope.data.imageId + '?specification=dockerhost');
            };
        }
    ]);
}(window.JP.getModule('docker')));
