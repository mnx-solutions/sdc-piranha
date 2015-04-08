'use strict';

(function (app) {
    app.controller('Docker.ImageDetailsController', [
        '$scope',
        'Docker',
        'Machine',
        'PopupDialog',
        '$qe',
        'requestContext',
        'localization',
        '$location',
        'util',
        'dockerPushImage',
        function ($scope, Docker, Machine, PopupDialog, $qe, requestContext, localization, $location, util, dockerPushImage) {
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
            $scope.pushDialogOpening = false;
            $scope.actionInProgress = false;

            var errorCallback = function (err) {
                $scope.loading = false;
                $scope.pushDialogOpening = false;
                $scope.actionInProgress = false;
            };

            var getDockerInspectImage = function () {
                var host = $qe.when(Docker.listHosts({id:hostId}));
                host.then(function (machine) {
                    var primaryIp = machine.primaryIp;
                    var hostId = machine.id;
                    image.primaryIp = primaryIp;
                    image.hostId = machine.id;
                    var tasks = [
                        $qe.when(Docker.inspectImage(image)),
                        $qe.when(Docker.listContainers({host: 'All', options: {all: true}})),
                        $qe.when(Docker.getAuditInfo({event: {type: 'image', host: hostId, entry: imageId}, params: true})),
                        $qe.when(Docker.historyImage(image))
                    ];

                    $qe.every(tasks).then(function (result) {
                        $scope.images = result[3] && Array.isArray(result[3]) ? result[3] : [];
                        $scope.image = result[0] || {};
                        $scope.audit = result[2] || [];
                        $scope.audit.forEach(function (event) {
                            event.hostName = machine.name || machine.id;
                        });
                        $scope.images.forEach(function (image) {
                            if ($scope.image.Id === image.Id) {
                                $scope.image.info = image;
                            }
                            image.ShortId = image.Id.slice(0, 12);
                            image.Created = new Date(image.Created * 1000);
                        });
                        $scope.image.isSdc = machine.isSdc;
                        $scope.image.info = $scope.image.info || $scope.image;
                        $scope.imageInfoTags = '';
                        if ($scope.image.info && $scope.image.info.Tags) {
                            $scope.imageInfoTags = $scope.image.info.Tags.join(', ');
                        }
                        var hostsContainers = result[1] || [];
                        $scope.imageContainer = $scope.image.Container.slice(0, 12);
                        var container = hostsContainers.find(function (container) {
                            return container.Id === $scope.image.Container;
                        });
                        if (container) {
                            $scope.imageContainer = '<a href="#!/docker/container/' + hostId + '/' + $scope.image.Container + '">' + $scope.imageContainer + '</a>';
                        }
                        var imageTags = $scope.image.info.Tags;
                        $scope.usedIn = hostsContainers.filter(function (container) {
                            if (!imageTags || (imageTags && imageTags.length === 0)) {
                                return container.Image === $scope.image.Id.slice(0, 12);
                            }
                            return imageTags.some(function (tag) {
                                return container.Image === tag;
                            });
                        });
                        $scope.loading = false;
                        $scope.actionInProgress = false;
                    }, errorCallback);
                }, function () {
                    $location.path('/docker/images');
                });
            };

            getDockerInspectImage();

            $scope.gridOrder = ['-Created'];
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
                        return image.Tags ? Docker.getImageTagsList(image.Tags) : '';
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
                    entryType: Number,
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

            $scope.createContainer = function () {
                $location.path('/docker/container/create/' + hostId + '/' + imageId);
            };

            $scope.removeImage = function () {
                $scope.actionInProgress = true;
                Docker.listContainers({host: {primaryIp: image.primaryIp, id: image.hostId}, options: {all: true}}).then(function (containers) {
                    var container = containers.find(function (container) {
                        return (Array.isArray($scope.image.info.Tags) && $scope.image.info.Tags.indexOf(container.Image) !== -1) ||
                            container.Image.substr(0, 12) === $scope.image.Id.substr(0, 12);
                    });

                    if (container) {
                        $scope.actionInProgress = false;
                        PopupDialog.message(null, 'This image has active containers.  Please remove them first.');
                        return;
                    }
                    if ($scope.image.info.Tags && $scope.image.info.Tags.length > 1) {
                        PopupDialog.confirm(
                            localization.translate($scope, null, 'Confirm: Remove image'),
                            localization.translate($scope, null, 'This image has more than one tag.  Are you sure you want to remove it?'),
                            function () {
                                Docker.forceRemoveImage({host: {primaryIp: image.primaryIp, id: image.hostId}, options: {id: image.Id}}).then(function () {
                                    $location.path('/docker/images');
                                }, errorCallback);
                            },
                            function () {
                                $scope.actionInProgress = false;
                            }
                        );
                    } else {
                        PopupDialog.confirm(
                            localization.translate($scope, null, 'Confirm: Remove image'),
                            localization.translate($scope, null, 'Please confirm that you want to remove this image.'),
                            function () {
                                Docker.removeImage(image).then(function () {
                                    $location.path('/docker/images');
                                }, errorCallback);
                            },
                            function () {
                                $scope.actionInProgress = false;
                            }
                        );
                    }

                });
            };

            $scope.pushImage = function () {
                if ($scope.image.isSdc) {
                    PopupDialog.error(null, 'Pushing SDC-Docker images is not presently supported.');
                    return;
                }
                var pushedImage = angular.copy(image);
                pushedImage.Id = $scope.image.Id;
                pushedImage.RepoTag = $scope.image.info.Tags ? $scope.image.info.Tags[0] : null;
                return dockerPushImage(pushedImage);
            };
        }
    ]);
}(window.JP.getModule('docker')));
