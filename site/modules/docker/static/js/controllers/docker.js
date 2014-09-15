'use strict';

(function (app) {
    app.controller('Docker.IndexController', [
        '$scope',
        '$rootScope',
        '$q',
        '$qe',
        'requestContext',
        'localization',
        '$location',
        'Datacenter',
        'Image',
        'Machine',
        'PopupDialog',

        function ($scope, $rootScope, $q, $qe, requestContext, localization, $location, Datacenter, Image, Machine, PopupDialog) {
            localization.bind('docker.index', $scope);
            requestContext.setUpRenderContext('docker.index', $scope, {
                title: localization.translate(null, 'docker', 'See my Joyent Docker Instances')
            });

            $scope.data = {
                datacenter: '',
                imageId: ''
            };

            Datacenter.datacenter().then(function (datacenters) {
                $scope.datacenters = datacenters;
                $scope.data.datacenter = $scope.datacenters[0].name;
            }, function (err) {
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
