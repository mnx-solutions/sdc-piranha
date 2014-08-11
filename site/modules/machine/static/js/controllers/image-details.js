'use strict';

(function (ng, app) {
    app.controller('Machine.ImageDetailsController', [
        '$scope',
        '$$track',
        'requestContext',
        'Image',
        'localization',
        'PopupDialog',
        '$location',
        'Machine',

        function ($scope, $$track, requestContext, Image, localization, PopupDialog, $location, Machine) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.images-details', $scope, {
                title: localization.translate(null, 'machine', 'Image Details')
            });

            var currentImageId = requestContext.getParam('currentImage');
            $scope.currentImage = {};
            $scope.oldImageData = {};
            var loadImage = function () {
                Image.image({id: currentImageId}).then(function (data) {
                    $scope.loading = false;
                    $scope.oldImageData = ng.copy(data);
                    $scope.currentImage = data;
                }, function (err) {
                    PopupDialog.errorObj(err);
                    $scope.currentImage = {};
                    $scope.loading = false;
                });
            };

            loadImage();
            $scope.updateImage = function () {
                $scope.loading = true;
                Image.updateImage($scope.currentImage, function () {}).promise.then(function () {
                    $scope.loading = false;
                }, function (err) {
                    PopupDialog.errorObj(err);
                    $scope.loading = false;
                });
            };

            $scope.cancel = function () {
                Image.resetImage($scope.oldImageData, function () {
                    $location.path('/images');
                    $location.replace();
                });
            };

            $scope.machines = Machine.machine();
            $scope.$watch('machines.final', function (isFinal) {
                if (isFinal) {
                    $scope.machines = $scope.machines.filter(function (machine) {
                        return machine.image === currentImageId;
                    });
                }
            });
            $scope.machinesGridOrder = [];

            $scope.machinesGridProps = [
                {
                    id: 'machineName',
                    name: 'Name',
                    type: 'html',
                    active: true,
                    hideSorter: true,
                    _getter: function (object) {
                        return '<a href="#!/compute/instance/' + object.id + '">' + object.name + '</a>';
                    }
                }
            ];
            $scope.machinesGridExportFields = {
                ignore: 'all'
            };

            $scope.deleteImage = function () {
                PopupDialog.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Delete image'
                    ),
                    localization.translate(
                        $scope,
                        'machine',
                        'Are you sure you want to delete this image?'
                    ), function () {
                        $$track.event('image', 'delete');
                        Image.deleteImage($scope.currentImage).promise.then(function () {
                            if (requestContext.getParam('currentImage') === $scope.currentImage.id) {
                                $location.url('/images');
                                $location.replace();
                            }
                        });
                    });
            };

            $scope.createInstance = function () {
                var createInstanceUrl = '/compute/create/' + $scope.currentImage.id;
                $location.url(createInstanceUrl);
                $location.replace();
            };
        }
    ]);
}(window.angular, window.JP.getModule('Machine')));
