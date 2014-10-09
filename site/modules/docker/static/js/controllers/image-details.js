'use strict';

(function (app) {
    app.controller('Docker.ImageDetailsController', [
        '$scope',
        'Docker',
        'Machine',
        'PopupDialog',
        '$q',
        'requestContext',
        'localization',
        '$location',
        'util',
        function ($scope, Docker, Machine, PopupDialog, $q, requestContext, localization, $location, util) {
            localization.bind('docker', $scope);
            requestContext.setUpRenderContext('docker.images-details', $scope, {
                title: localization.translate(null, 'docker', 'View Joyent Image Details')
            });

            var imageId = requestContext.getParam('imageid');
            var hostId = requestContext.getParam('hostid');
            var image = {
                Id: imageId
            };

            $scope.loading = true;
            $scope.actionInProgress = false;

            var errorCallback = function (err) {
                $scope.loading = false;
                $scope.actionInProgress = false;
                PopupDialog.errorObj(err);
            };

            var getDockerInspectImage = function () {
                var machine = $q.when(Machine.machine(hostId));
                machine.then(function (machine) {
                    var primaryIp = machine.primaryIp;
                    image.primaryIp = primaryIp;
                    $q.all([
                        $q.when(Docker.inspectImage(image)),
                        $q.when(Docker.historyImage(image))
                    ]).then(function (result) {
                        $scope.images = result[1] || [];
                        $scope.image = result[0] || {};
                        $scope.images.forEach(function (image) {
                            if ($scope.image.Id === image.Id) {
                                $scope.image.info = image;
                            }
                            image.Id = image.Id.slice(0, 12);
                            image.Created = new Date(image.Created * 1000);
                        });
                        $scope.imageContainer = $scope.image.Container.slice(0, 12);
                        Docker.inspectContainer({primaryIp: primaryIp, Id: $scope.imageContainer}).then(function (resp) {
                            $scope.imageContainer = '<a href="#!/docker/container/' + hostId + '/' + $scope.imageContainer + '">' + $scope.imageContainer + '</a>';
                        });
                        $scope.loading = false;
                        $scope.actionInProgress = false;
                    }, errorCallback);
                }, function () {
                    $location.path('/docker/images');
                });
            };

            getDockerInspectImage();

            $scope.gridOrder = [];
            $scope.gridProps = [
                {
                    id: 'Id',
                    name: 'Image ID',
                    sequence: 1,
                    active: true
                },
                {
                    id: 'repository',
                    name: 'Repository',
                    _order: 'repo',
                    sequence: 2,
                    active: true,
                    type: 'html',
                    _getter: function (image) {
                        return image.Tags ? image.Tags[0].split(':')[0] : '';
                    }
                },
                {
                    id: 'tag',
                    name: 'Tag',
                    sequence: 3,
                    active: true,
                    type: 'html',
                    _getter: function (image) {
                        return image.Tags ? image.Tags[0].split(':')[1] : '';
                    }
                },
                {
                    id: 'Created',
                    name: 'Created',
                    sequence: 4,
                    active: true,
                    type: 'date',
                    reverseSort: true
                },
                {
                    id: 'Size',
                    name: 'Size',
                    sequence: 5,
                    active: true,
                    _order: 'Size',
                    _getter: function (image) {
                        return util.getReadableFileSizeString(image.Size);
                    }
                },
                {
                    id: 'CreatedBy',
                    name: 'CreatedBy',
                    sequence: 6,
                    active: true
                }
            ];

            $scope.gridActionButtons = [];

            $scope.exportFields = {
                ignore: []
            };
            $scope.searchForm = false;
            $scope.enabledCheckboxes = false;

            $scope.removeImage = function () {
                PopupDialog.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Remove image'
                    ),
                    localization.translate(
                        $scope,
                        null,
                        'Please confirm that you want to remove this image.'
                    ), function () {
                        $scope.actionInProgress = true;
                        Docker.removeImage(image).then(function () {
                            $location.path('/docker/images');
                        }, errorCallback);
                    });
            };
        }
    ]);
}(window.JP.getModule('docker')));