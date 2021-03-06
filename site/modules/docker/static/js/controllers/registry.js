'use strict';

(function (ng, app) {
    app.controller(
        'Docker.RegistryController', [
            '$scope',
            '$filter',
            'Docker',
            'Account',
            'PopupDialog',
            'localization',
            '$location',
            'requestContext',
            'notification',
            'util',
            function ($scope, $filter, Docker, Account, PopupDialog, localization, $location, requestContext, notification, util) {

                $scope.registryId = requestContext.getParam('id');

                $scope.loading = true;
                $scope.imagesLoading = false;
                $scope.registries = [];
                $scope.registryApiVersions = ['v1', 'v2'];

                var newRegistry = function (type) {
                    $scope.registry = {
                        api: '',
                        host: '',
                        port: '',
                        username: '',
                        email: '',
                        password: '',
                        type: type
                    };
                };

                $scope.registries = [];

                var errorCallback = function (err) {
                    Docker.errorCallback(err, function () {
                        $scope.loading = false;
                    });
                };

                if ($scope.features.manta === 'enabled') {
                    $scope.gridUserConfig = 'docker-local-registry-images';
                }

                Docker.getRegistriesList().then(function (list) {
                    $scope.registries = list;
                    $scope.loading = false;
                    if ($scope.registryId === 'create') {
                        $scope.registryId = null;
                        newRegistry(Docker.REGISTRY_REMOTE);

                    } else {
                        $scope.registries.forEach(function (registry) {
                            if (registry.id === $scope.registryId) {
                                $scope.registry = registry;
                                $scope.portChanged($scope.registry.port);
                                var imagesByName = {};
                                $scope.imagesLoading = true;
                                Docker.registryImages($scope.registryId, function (error, chunks) {
                                    if (error) {
                                        return errorCallback(error);
                                    }
                                    chunks.forEach(function (chunk) {
                                        if (chunk.images) {
                                            $scope.imagesLoading = false;
                                            chunk.images.forEach(function (image) {
                                                image.info = image.info || {};
                                                var imageFullName = image.name + ':' + image.tag;
                                                imagesByName[imageFullName] = image;
                                                var registryId = $scope.registry.id;
                                                if ($scope.registry.type === Docker.REGISTRY_LOCAL) {
                                                    registryId = $scope.registry.type;
                                                }
                                                Docker.getImageTags(registryId, image.name).then(function (tags) {
                                                    image.tags = tags || [];
                                                }, function (err) {
                                                    return errorCallback(err.error || err);
                                                });
                                                image.loading = true;
                                            });
                                            $scope.images = chunk.images;
                                        } else if (chunk.name && chunk.info && chunk.info.size !== undefined) {
                                            var imageFullName = chunk.name + ':' + chunk.tag;
                                            var image = imagesByName[imageFullName];
                                            if (!image) {
                                                return;
                                            }

                                            image.loading = false;
                                            image.size = chunk.info.size;
                                            if (chunk.info.images && chunk.info.images[0]) {
                                                image.layoutId = chunk.info.images[0].id;
                                                image.created = new Date(chunk.info.images[0].created);
                                            }
                                        }
                                    });
                                }).then(function () {
                                    $scope.imagesLoading = false;
                                }, errorCallback);
                            }
                        });
                    }
                });

                $scope.gridOrder = [];
                $scope.gridProps = [
                    {
                        id: 'name',
                        name: 'Name',
                        sequence: 1,
                        active: true,
                        type: 'progress',
                        _inProgress: function (object) {
                            return object.actionInProgress;
                        }
                    },
                    {
                        id: 'tag',
                        name: 'Tag',
                        sequence: 1,
                        active: true
                    },
                    {
                        id: 'created',
                        name: 'Created',
                        sequence: 2,
                        active: true,
                        reverseSort: true,
                        _order: 'created',
                        type: 'progress',
                        _inProgress: function (object) {
                            return object.loading;
                        },
                        _getter: function (image) {
                            return image.created ? $filter('humanDate')(image.created / 1000)  : '';
                        }
                    },
                    {
                        id: 'info.size',
                        name: 'Size',
                        sequence: 3,
                        active: true,
                        _order: 'info.size',
                        entryType: Number,
                        type: 'progress',
                        _inProgress: function (object) {
                            return object.loading;
                        },
                        _getter: function (image) {
                            return image.size ? util.getReadableFileSizeString(image.size) : '';
                        }
                    }
                ];

                // TODO: currently, v2 does not support deleting tags
                /*
                $scope.gridActionButtons = [
                    {
                        label: 'Remove',
                        action: function () {
                            $scope.images.forEach(function (image, index) {
                                if (!image.checked) {
                                    return;
                                }
                                image.actionInProgress = true;
                                var opts = {
                                    registryId: $scope.registry.id,
                                    name: image.name,
                                    tag: image.tag
                                };
                                Docker.registryRemoveImage(opts).then(function () {
                                    $scope.images.splice(index, 1);
                                }, function () {
                                    image.actionInProgress = false;
                                    return errorCallback.apply(this, arguments);
                                });
                            });
                        },
                        sequence: 1
                    }
                ];
                */

                $scope.exportFields = {
                    ignore: []
                };

                $scope.portChanged = function (port) {
                    $scope.portValid = /^\d+$/.test(port) && port > -1 && port < 65536;
                    if ($scope.portValid) {
                        $scope.registry.port = parseInt($scope.registry.port, 10);
                    }
                };

                var addRegistry = function (registry) {
                    if (!registry.id) {
                        registry.id = uuid();
                        $scope.registries.push(registry);
                    }
                    Docker.saveRegistry(registry).then(function () {
                        $location.path('docker/registries');
                    });
                };

                var isExistingRegistry = function (connectedRegistry) {
                    return $scope.registries.some(function (registry) {
                        registry.id = registry.id || '';
                        return Docker.getRegistryUrl(registry) === Docker.getRegistryUrl(connectedRegistry) &&
                            (registry.username || '') === (connectedRegistry.username || '') &&
                            registry.id !== connectedRegistry.id;
                    });
                };

                $scope.connectRegistry = function () {
                    $scope.loading = true;
                    var registryExist = isExistingRegistry($scope.registry);
                    if (registryExist) {
                        $scope.loading = false;
                        return PopupDialog.error(
                            localization.translate(
                                $scope,
                                null,
                                'Error'
                            ),
                            localization.translate(
                                $scope,
                                null,
                                'This registry already exists.'
                            )
                        );
                    }
                    var registry = ng.extend({}, $scope.registry);
                    var action = Docker.PING_ACTION;
                    if (registry.username && registry.password) {
                        action = Docker.AUTH_ACTION;
                        registry.serveraddress = Docker.getRegistryUrl(registry);
                    }

                    Docker[action](registry).then(function (response) {
                        if (response) {
                            var hubMessage = response.Status || response.toString();
                            if (action === Docker.AUTH_ACTION && hubMessage.indexOf('Account created') !== -1) {
                                notification.success(hubMessage);
                            }
                            if (action === Docker.PING_ACTION) {
                                delete $scope.registry.username;
                                delete $scope.registry.password;
                                delete $scope.registry.email;
                            }
                            $scope.registry.api = response.apiVersion || $scope.registry.api;
                            addRegistry($scope.registry);
                        }
                    }, function (err) {
                        if (err.indexOf('html') > -1 || err.toLowerCase().indexOf('not found') > -1) {
                            err = 'Failed to connect: The requested URL <code>/v1/_ping</code> was not found.';
                        } else if (err.indexOf('Internal Server') > -1 || err.indexOf('connect ENETUNREACH') > -1 ||
                            err.indexOf('connect timeout') > -1 || err.indexOf('getaddrinfo ENOTFOUND') > -1 ||
                            err.indexOf('Internal error') > -1) {
                            err = 'Cannot connect to ' + $scope.registry.host;
                        } else if (err.indexOf('incorrect username or password') !== -1 ||
                            err.indexOf('UNAUTHORIZED') > -1) {
                            err = 'Authentication failed. Incorrect username or password.';
                        }
                        PopupDialog.errorObj(err);
                        $scope.loading = false;
                    });
                };

            }
        ]);
}(window.angular, window.JP.getModule('docker')));
