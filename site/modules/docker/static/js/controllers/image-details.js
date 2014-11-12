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
                            image.ShortId = image.Id.slice(0, 12);
                            image.Created = new Date(image.Created * 1000);
                        });
                        $scope.imageInfoTags = '';
                        if ($scope.image.info && $scope.image.info.Tags) {
                            $scope.imageInfoTags = $scope.image.info.Tags.join(', ');
                        }
                        $scope.imageContainer = $scope.image.Container.slice(0, 12);
                        Docker.inspectContainer({primaryIp: primaryIp, Id: $scope.imageContainer}).then(function (resp) {
                            $scope.imageContainer = '<a href="#!/docker/container/' + hostId + '/' + $scope.image.Container + '">' + $scope.imageContainer + '</a>';
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
                Docker.listContainers({host: {primaryIp: image.primaryIp}, options: {all: true}}).then(function (containers) {
                    var container = containers.find(function (container) {
                        return (Array.isArray($scope.image.info.Tags) && $scope.image.info.Tags.indexOf(container.Image) !== -1)
                            || container.Image.substr(0, 12) === $scope.image.Id.substr(0, 12);
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
                                Docker.forceRemoveImage({host: {primaryIp: image.primaryIp}, options: {id: image.Id}}).then(function () {
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

            function urlParser(url) {
                var a = document.createElement('a');
                a.href = url;
                return a;
            }

            $scope.pushImage = function () {
                PopupDialog.custom({
                    templateUrl: 'docker/static/partials/push-image.html',
                    openCtrl: ['$scope', 'dialog', 'Docker', 'notification', function (scope, dialog, Docker, notification) {
                        var tags = $scope.image.info.Tags || [];
                        var parsedTag = Docker.parseTag(tags[0]);
                        scope.loading = true;
                        scope.registries = [];
                        scope.tag = '';
                        scope.imageName = parsedTag.name;
                        scope.input = {
                            registryId: '',
                            name: parsedTag.name || ''
                        };

                        Docker.getRegistriesList(true, image.primaryIp).then(function (result) {
                            scope.registries = result.short;
                            scope.loading = false;
                        }, errorCallback);

                        scope.close = function () {
                            window.jQuery('#registrySelect').select2('close');
                            dialog.close();
                        };
                        scope.errorMessage = function () {
                            var viewValue = scope.newRegistryForm.name.$viewValue;
                            var tag = Docker.parseTag(viewValue);
                            var message = '';
                            if (tag.repository && tag.repository.length < 4) {
                                message = 'The author part must be at least 4 characters long.';
                            } else if (!/^[a-z0-9-\.\/:]+$/.test(viewValue)) {
                                message = 'Please do not use special characters.';
                            }
                            return message;
                        };
                        scope.push = function () {
                            var registry;
                            if (scope.input.registryId === 'local') {
                                registry = {
                                    id: 'local',
                                    host: 'http://localhost',
                                    port: 5000,
                                    type: 'local'
                                };
                            } else {
                                registry = scope.registries.find(function (registry) {
                                    return registry.id === scope.input.registryId;
                                });
                            }
                            PopupDialog.message(null, 'Pushing images takes some time. You can continue your work and get notification once push is completed.');
                            Docker.pushImage({
                                host: {primaryIp: image.primaryIp},
                                options: {
                                    image: angular.copy($scope.image),
                                    registry: registry,
                                    tag: parsedTag.tag,
                                    name: scope.input.name
                                }
                            }, function (error) {
                                if (error) {
                                    notification.error(error);
                                }
                            }).then(function (result) {
                                notification.success('Pushing of image "' + scope.input.name + '" is completed.');
                            }, function (error) {
                                notification.error(error);
                            });
                            scope.close();
                        };
                    }]
                });
            };
        }
    ]);
}(window.JP.getModule('docker')));
