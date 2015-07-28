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
                    $scope.gridUserConfig = 'docker-local-registry-images';
                }

                var registryImageTag = function (action, imageName, tagName, layoutId, callback) {
                    Docker.registryImageTag(action, $scope.registry.id, imageName, tagName, layoutId).then(function () {
                        callback();
                    }, function (err) {
                        callback(err);
                        return errorCallback(err);
                    });
                };

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
                                                var registryId = $scope.registry.id;
                                                if ($scope.registry.type === 'local') {
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
                                            var image = imagesByName[chunk.name];
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
                var checkImageTagDuplicate = function (tags, name, index) {
                    if (!tags.length) {
                        return false;
                    }
                    var hasDuplicates = tags.some(function (t, i) {
                        return t.name.toLowerCase() === name.toLowerCase() && i !== index;
                    });
                    if (hasDuplicates) {
                        PopupDialog.error(
                            localization.translate(
                                $scope,
                                null,
                                'Error'
                            ),
                            localization.translate(
                                $scope,
                                null,
                                'Duplicate tag.'
                            )
                        );
                    }
                    return hasDuplicates;
                };

                function isRegistryTypeRemote() {
                    return $scope.registry.type === 'remote';
                }

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
                    },
                    {
                        id: '',
                        name: 'Action',
                        sequence: 6,
                        active: true,
                        type: 'buttons',
                        buttons: [
                            {
                                label: 'Tag',
                                getClass: function () {
                                    return 'btn grey';
                                },
                                disabled: function (object) {
                                    return object.loading || object.actionInProgress;
                                },
                                action: function (object) {
                                    ng.element('.btn.grey').blur();
                                    PopupDialog.custom({
                                        templateUrl: 'docker/static/partials/image-add-tag.html',
                                        openCtrl: function ($scope, dialog) {
                                            $scope.isRegistryTypeRemote = isRegistryTypeRemote();
                                            $scope.newTag = '';
                                            $scope.tags = angular.copy(object.tags) || [];
                                            var storeTags = function () {
                                                $scope.lastSavedTags = angular.copy(object.tags);
                                            };
                                            $scope.focusOut = function () {
                                                if (!$scope.lastSavedTags) {
                                                    return;
                                                }
                                                $scope.lastSavedTags.forEach(function (lastTag, index) {
                                                    if ($scope.tags[index].name !== lastTag.name) {
                                                        $scope.tags[index].name = lastTag.name;
                                                    }
                                                    $scope.tags[index].edit = false;
                                                });
                                            };
                                            $scope.editTag = function (tag) {
                                                if ($scope.isRegistryTypeRemote) {
                                                    return;
                                                }
                                                storeTags();
                                                $scope.focusOut();
                                                tag.edit = true;
                                            };
                                            // removeImageTag isn't working on remote registry due to an issue:
                                            // https://github.com/docker/docker/issues/8759
                                            $scope.removeTag = function (tag) {
                                                tag.actionInProgress = true;
                                                registryImageTag('removeImageTag', object.name, tag.name, JSON.stringify(object.layoutId), function (error) {
                                                    if (error) {
                                                        return;
                                                    }
                                                    $scope.tags = $scope.tags.filter(function (item) {
                                                        return item.name !== tag.name;
                                                    });
                                                    object.tags = $scope.tags;
                                                    storeTags();
                                                });

                                            };
                                            $scope.addTag = function () {
                                                if (!checkImageTagDuplicate($scope.tags, $scope.newTag)) {
                                                    $scope.newTagInProgress = true;
                                                    registryImageTag('addImageTag', object.name, $scope.newTag, JSON.stringify(object.layoutId), function (error) {
                                                        if (error) {
                                                            $scope.newTagInProgress = false;
                                                            return;
                                                        }
                                                        $scope.tags.push({name: $scope.newTag, edit: false, id: object.layoutId});
                                                        object.tags = $scope.tags;
                                                        storeTags();
                                                        $scope.newTag = '';
                                                        $scope.newTagInProgress = false;
                                                    });
                                                }
                                            };
                                            $scope.saveTag = function (tag, index) {
                                                if (!checkImageTagDuplicate($scope.tags, tag.name, index)) {
                                                    var oldTag = angular.copy($scope.lastSavedTags ? $scope.lastSavedTags[index] : $scope.tags[index]);
                                                    tag.actionInProgress = true;
                                                    tag.edit = false;
                                                    registryImageTag('addImageTag', object.name, tag.name, JSON.stringify(object.layoutId), function (error) {
                                                        if (error) {
                                                            tag.actionInProgress = false;
                                                            return;
                                                        }
                                                        $scope.tags[index].name = tag.name;
                                                        object.tags = $scope.tags;
                                                        $scope.removeTag(oldTag);
                                                        tag.actionInProgress = false;
                                                    });

                                                }
                                            };
                                            $scope.close = function () {
                                                if ($scope.tags.length) {
                                                    $scope.focusOut();
                                                }
                                                dialog.close();
                                            };
                                        }
                                    });
                                }
                            }
                        ]
                    }
                ];

                $scope.noCheckBoxChecked = function () {
                    PopupDialog.noItemsSelectedError('images');
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
                                parseInt(registry.port, 10) === connectedRegistry.port &&
                                checkAuth && registry.id !== connectedRegistry.id) {
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
                                'This registry already exists.'
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
