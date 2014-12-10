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
                $scope.registryApiVersions = ['v1'];

                var newRegistry = function (type) {
                    $scope.registry = {
                        api: $scope.registryApiVersions[0],
                        host: null,
                        port: null,
                        username: null,
                        email: null,
                        password: null,
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
                    $scope.gridUserConfig = Account.getUserConfig().$child('docker-local-registry-images');
                }

                Docker.getRegistriesList().then(function (list) {
                    $scope.registries = list;
                    $scope.loading = false;
                    if ($scope.registryId === 'create') {
                        $scope.registryId = null;
                        newRegistry('remote');

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
                                                imagesByName[image.name] = image;
                                                image.loading = true;
                                            });
                                            $scope.images = chunk.images;
                                        } else if (chunk.name && chunk.info && chunk.info.size !== undefined) {
                                            var image = imagesByName[chunk.name];
                                            image.loading = false;
                                            image.size = chunk.info.size;
                                            if (chunk.info.images && chunk.info.images[0]) {
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
                        id: 'created',
                        name: 'Created',
                        sequence: 4,
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
                        sequence: 5,
                        active: true,
                        _order: 'info.size',
                        type: 'progress',
                        _inProgress: function (object) {
                            return object.loading;
                        },
                        _getter: function (image) {
                            return image.size ? util.getReadableFileSizeString(image.size) : '';
                        }
                    }
                ];

                $scope.noCheckBoxChecked = function () {
                    PopupDialog.error(
                        localization.translate(
                            $scope,
                            null,
                            'Error'
                        ),
                        localization.translate(
                            $scope,
                            null,
                            'No images selected for the action.'
                        )
                    );
                };

                $scope.gridActionButtons = [
                    {
                        label: 'Remove',
                        action: function () {
                            $scope.images.forEach(function (image, index) {
                                if (!image.checked) {
                                    return;
                                }
                                image.actionInProgress = true;
                                Docker.registryRemoveImage({registryId: $scope.registry.id, name: image.name}).then(function () {
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

                $scope.exportFields = {
                    ignore: []
                };

                $scope.portChanged = function (port) {
                    $scope.portValid = /^\d+$/.test(port) && port > -1 && port < 65536;
                    if ($scope.portValid) {
                        $scope.registry.port = Number($scope.registry.port);
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

                var checkExists = function (connectedRegistry) {
                    var exist = false;
                    var checkAuth = true;
                    $scope.registries.forEach(function (registry) {
                        if (connectedRegistry.username && connectedRegistry.password) {
                            checkAuth = registry.username == connectedRegistry.username && registry.email == connectedRegistry.email;
                        }
                        registry.id = registry.id || '';
                        if (registry.api === connectedRegistry.api &&
                                registry.host === connectedRegistry.host &&
                                registry.port === connectedRegistry.port && checkAuth &&
                                registry.id !== connectedRegistry.id) {
                            exist = true;
                        }
                    });
                    return exist;
                };

                $scope.connectRegistry = function () {
                    $scope.loading = true;
                    var registryExist = checkExists($scope.registry);
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
                                'Such a registry already exists.'
                            )
                        );
                    }
                    var registry = ng.extend({}, $scope.registry);
                    var action = 'registryPing';
                    if (registry.username && registry.password) {
                        action = 'auth';
                        registry.serveraddress = registry.host + '/' + registry.api + '/';
                        delete registry.host;
                        delete registry.api;
                    }
                    Docker[action](registry).then(function (result) {
                        if (result) {
                            var hubMessage = result.Status || result.toString();
                            if (action === 'auth' && hubMessage.indexOf('Account created') !== -1) {
                                notification.success(hubMessage);
                            }
                            if (action === 'registryPing') {
                                delete $scope.registry.username;
                                delete $scope.registry.password;
                                delete $scope.registry.email;
                            }
                            addRegistry($scope.registry);
                        }
                    }, function (err) {
                        if (err.indexOf('html') > -1 || err.toLowerCase().indexOf('not found') > -1) {
                            err = 'Failed to connect: The requested URL <code>/v1/_ping</code> was not found.';
                        } else if (err.indexOf('Internal Server') > -1 || err.indexOf('connect ENETUNREACH') > -1 ||
                            err.indexOf('connect timeout') > -1 || err.indexOf('getaddrinfo ENOTFOUND') > -1) {
                            err = 'Cannot connect to ' + $scope.registry.host;
                        }
                        PopupDialog.errorObj(err);
                        $scope.loading = false;
                    });
                };

            }
        ]);
}(window.angular, window.JP.getModule('docker')));
