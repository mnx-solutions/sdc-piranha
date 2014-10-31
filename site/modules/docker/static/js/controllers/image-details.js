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
                        $scope.imageInfoTags = '';
                        if ($scope.image.info && $scope.image.info.Tags) {
                            $scope.imageInfoTags = $scope.image.info.Tags.join(', ');
                        }
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
                    ),
                    function () {
                        $scope.actionInProgress = true;
                        Docker.removeImage(image).then(function () {
                            $location.path('/docker/images');
                        }, errorCallback);
                    }
                );
            };

            function parseTag(tag) {
                var parts = /(?:([^:]+:\d+)\/)?((?:([^\/]+)\/)?([^:]+))(?::(\w+))?/.exec(tag);
                if (!parts || !tag) {
                    return {};
                }

                return {
                    tag: parts[5],
                    name: parts[4],
                    repository: parts[3] || '',
                    fullname: parts[2],
                    registry: parts[1]
                };
            }

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
                        var parsedTag = parseTag(tags[0]);
                        scope.loading = true;
                        scope.registries = [];
                        scope.tag = '';
                        scope.imageName = parsedTag.fullname;
                        scope.input = {
                            registry: {},
                            name: parsedTag.fullname || ''
                        };

                        Docker.getRegistriesList().then(function (registries) {
                            scope.registries = registries;
                            if (parsedTag.registry) {
                                scope.input.registry = registries.find(function (registry) {
                                    return urlParser(registry.host).host === parsedTag.registry;
                                });
                            }
                            scope.loading = false;
                        }, errorCallback);

                        scope.close = function () {
                            dialog.close();
                        };

                        scope.push = function () {
                            PopupDialog.message(null, 'Pushing images takes some time. You can continue your work and get notification once push is completed.');
                            Docker.pushImage({
                                host: {primaryIp: image.primaryIp},
                                options: {
                                    image: angular.copy($scope.image),
                                    registry: scope.input.registry,
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
                            dialog.close();
                        };
                    }]
                });
            };
        }
    ]);
}(window.JP.getModule('docker')));
