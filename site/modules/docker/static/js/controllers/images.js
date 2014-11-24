'use strict';

(function (app) {
    app.controller(
        'Docker.ImagesController', [
            '$scope',
            'requestContext',
            'localization',
            'Docker',
            '$q',
            'PopupDialog',
            '$location',
            '$filter',
            'util',
            'Account',
            function ($scope, requestContext, localization, Docker, $q, PopupDialog, $location, $filter, util, Account) {
                localization.bind('docker', $scope);
                requestContext.setUpRenderContext('docker.images', $scope, {
                    title: localization.translate(null, 'docker', 'See my Joyent Docker Images')
                });

                var allImages = false;
                var topImages = [];
                $scope.loading = true;
                $scope.pullDialogOpening = false;

                var errorCallback = function (err) {
                    Docker.errorCallback(err, function () {
                        $scope.loading = false;
                        $scope.pullDialogOpening = false;
                    });
                };

                if ($scope.features.manta === 'enabled') {
                    $scope.gridUserConfig = Account.getUserConfig().$child('docker-images');
                }
                var getGroupedImages = function (originalImages) {
                    var groupedImages = [];
                    originalImages.forEach(function (origImage) {
                        var found = false;
                        groupedImages.forEach(function (grImage) {
                            if (origImage.Id === grImage.Id) {
                                if (!grImage.hostIds) {
                                    grImage.hostIds = [grImage.hostId];
                                }
                                if (!grImage.hostNames) {
                                    grImage.hostNames = [grImage.hostName];
                                }
                                if (grImage.hostIds.indexOf(origImage.hostId) === -1) {
                                    grImage.hostIds.push(origImage.hostId);
                                }
                                if (grImage.hostNames.indexOf(origImage.hostName) === -1) {
                                    grImage.hostNames.push(origImage.hostName);
                                }
                                found = true;
                            }
                        });
                        if (!found) {
                            groupedImages.push(origImage);
                        }
                    });
                    return groupedImages;
                };
                var imagesWithoutGrouping = [];
                var listAllImages = function (all) {
                    topImages = all ? topImages : [];
                    Docker.listAllImages(all ? {all: true, cache: true} : {cache: true}).then(function (images) {
                        images.forEach(function (image) {
                            image.ShorId = image.Id.slice(0, 12);
                            if (all) {
                                image.images = topImages.indexOf(image.ShorId) === -1 ? 'all' : 'top';
                            } else {
                                image.images = 'top';
                                topImages.push(image.ShorId);
                            }
                            image.repository = image.RepoTags ? image.RepoTags[0].split(':')[0] : '';
                        });
                        imagesWithoutGrouping = angular.copy(images);
                        $scope.images = getGroupedImages(images);
                        $scope.loading = false;
                        }, errorCallback);
                };

                $scope.query = requestContext.getParam('host') || '';
                $scope.gridOrder = ['-Created'];
                $scope.gridProps = [
                    {
                        id: 'Id',
                        name: 'Image ID',
                        sequence: 1,
                        active: true,
                        type: 'html',
                        _getter: function (image) {
                            var html;
                            if (!image.hostIds) {
                                html = '<a href="#!/docker/image/' + image.hostId + '/' + image.Id + '" style="min-width: 140px;">' + image.ShorId + '</a>';
                            } else {
                                html = '<span>' + image.ShorId + '</span>';
                            }
                            return html;
                        }
                    },
                    {
                        id: 'repository',
                        name: 'Repository',
                        _order: 'repository',
                        sequence: 2,
                        active: true,
                        type: 'progress',
                        _inProgress: function (image) {
                            return image.actionInProgress;
                        }
                    },
                    {
                        id: 'tag',
                        name: 'Tag',
                        sequence: 3,
                        active: true,
                        type: 'html',
                        _getter: function (image) {
                            return image.RepoTags ? Docker.getImageTagsList(image.RepoTags) : '';
                        }
                    },
                    {
                        id: 'hostName',
                        name: 'Host',
                        sequence: 4,
                        active: true,
                        _order: 'hostName',
                        type: 'html',
                        _getter: function (image) {
                            var html;
                            if (!image.hostIds) {
                                html = '<span>' + image.hostName + '</span>';
                            } else {
                                var html = [];
                                image.hostIds.forEach(function (hostId, index) {
                                    html.push('<a href="#!/docker/image/' + hostId + '/' + image.Id + '">' + image.hostNames[index] + '</a>');
                                });
                                html = html.join(', ');
                            }
                            return html;
                        }
                    },
                    {
                        id: 'Created',
                        name: 'Created',
                        sequence: 5,
                        active: true,
                        reverseSort: true,
                        _getter: function (image) {
                            return $filter('humanDate')(image.Created);
                        }
                    },
                    {
                        id: 'VirtualSize',
                        name: 'VirtualSize',
                        sequence: 6,
                        active: true,
                        _order: 'VirtualSize',
                        _getter: function (image) {
                            return util.getReadableFileSizeString(image.VirtualSize);
                        }
                    },
                    {
                        id: 'hostId',
                        name: 'Host Id',
                        sequence: 7,
                        active: true
                    }
                ];

                var gridMessages = {
                    remove: {
                        single: 'Please confirm that you want to remove this image.',
                        plural: 'Please confirm that you want to remove selected images.'
                    },
                    push: {
                        single: 'Please confirm that you want to push this image.',
                        plural: 'Please confirm that you want to push selected images.'
                    }
                };

                function makeImageAction(action, messageTitle, messageBody) {
                    var messageGroup = '';
                    if ($scope.checkedItems.length) {
                        var groupingImages = [];
                        $scope.checkedItems.forEach(function (image) {
                            if (image.hostNames && image.hostNames.length) {
                                groupingImages = imagesWithoutGrouping.filter(function (item) {
                                    return item.ParentId === image.ParentId && item.hostName !== image.hostName;
                                });
                            }
                        });
                        if (groupingImages.length) {
                            $scope.checkedItems = $scope.checkedItems.concat(groupingImages);
                            messageGroup = ' Please note that image can belong to multiple hosts.';
                        }

                        var actionFunction = function () {
                            var promises = [];
                            $scope.checkedItems.forEach(function (image) {
                                image.actionInProgress = true;
                                image.checked = false;
                                var deferred = $q.defer();
                                var currentData = image;
                                var currentAction = action;
                                if (action === 'remove' && image.RepoTags && image.RepoTags.length > 0) {
                                    currentAction = 'forceRemove';
                                    currentData = {host: {primaryIp: image.primaryIp}, options: {id: image.Id}};
                                }
                                Docker[currentAction + 'Image'](currentData).then(function (response) {
                                    deferred.resolve(response);
                                }, function (err) {
                                    deferred.reject(err);
                                    image.actionInProgress = false;
                                    image.checked = false;
                                    errorCallback(err);
                                });
                                promises.push(deferred.promise);
                            });

                            $q.all(promises).then(function () {
                                listAllImages();
                            });
                        };
                        if (messageTitle) {
                            PopupDialog.confirm(
                                localization.translate(
                                    $scope,
                                    null,
                                    messageTitle
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    messageBody[$scope.checkedItems.length > 1 ? 'plural' : 'single'] + messageGroup
                                ),
                                actionFunction
                            );
                        } else {
                            actionFunction();
                        }

                    } else {
                        $scope.noCheckBoxChecked();
                    }
                }

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
                            makeImageAction('remove', 'Confirm: Remove images', gridMessages.remove);
                        },
                        show: function () {
                            return $scope.tab !== 'all';
                        },
                        sequence: 1
                    }
                ];

                $scope.exportFields = {
                    ignore: []
                };
                $scope.searchForm = true;
                $scope.enabledCheckboxes = true;
                $scope.placeHolderText = 'filter images';
                $scope.tabFilterField = 'images';
                if (requestContext.getParam('host')) {
                    $scope.forceActive = 'hostId';
                }


                Docker.pingManta(function () {
                    listAllImages();
                });

                $scope.createImage = function () {
                    $location.path('/docker/image/create');
                };

                function getHostname(address) {
                    var a = document.createElement('a');
                    a.href = address;
                    return a.hostname;
                }

                function getSelectedRegistry(scope) {
                    return scope.registries.find(function (registry) {
                        return registry.id === scope.registryId;
                    });
                }

                function setRegistryHost(scope, image) {
                    var selectedRegistry = getSelectedRegistry(scope);
                    if (selectedRegistry) {
                        if (selectedRegistry.type === 'local') {
                            image.name = 'localhost:5000/' + image.name;
                        } else if (selectedRegistry.type === 'remote') {
                            var hostname = getHostname(selectedRegistry.host);
                            if (hostname !== 'index.docker.io') {
                                image.name = hostname + ':' + selectedRegistry.port + '/' + image.name;
                            }
                        }
                    }
                }

                function pullDialogOpeningStatus(status) {
                    $scope.pullDialogOpening = status;
                }

                //search images
                $scope.searchImages = function () {
                    $scope.pullDialogOpening = true;
                    var findImagesCtrl = function ($scope, dialog, Docker) {
                        var registry;
                        $scope.term = '';
                        $scope.loading = true;
                        $scope.searching = false;
                        Docker.getRegistriesList({aggregate: true}).then(function (result) {
                            $scope.registries = result.short;
                            $scope.fullRegistriesList = result.full;
                            $scope.registries = Docker.addRegistryUsernameToHost($scope.registries);
                            pullDialogOpeningStatus(false);
                            $scope.loading = false;
                        }, errorCallback);

                        function allowedIP($currentScope) {
                            return function () {
                                var selectedRegistry = getSelectedRegistry($scope);
                                if (!selectedRegistry || !$currentScope.hostIp || selectedRegistry.type === 'global' || selectedRegistry.type === 'remote') {
                                    return true;
                                }

                                return $scope.fullRegistriesList.some(function (registry) {
                                    return registry.type === 'local' && getHostname(registry.host) === $currentScope.hostIp;
                                });
                            };
                        }
                        $scope.pull = function () {
                            var image = Docker.parseTag($scope.term);
                            var findedImages =  $scope.findedImages = [];
                            var parentScope = $scope;
                            $scope.pulling = true;
                            PopupDialog.custom({
                                templateUrl: 'docker/static/partials/select-tag.html',
                                openCtrl: function ($scope, dialog, Docker) {
                                    $scope.name = image.name;
                                    $scope.tag = 'all';
                                    $scope.hideTags = true;
                                    Docker.listHosts().then(function (hosts) {
                                        $scope.hosts = hosts || [];
                                    });

                                    $scope.allowedIP = allowedIP($scope);
                                    $scope.pullImage = function () {
                                        findedImages.push(image);
                                        $scope.close();
                                        image.processing = true;
                                        image.processStatus = "Preparing";
                                        setRegistryHost(parentScope, image);
                                        Docker.pullImage({primaryIp: $scope.hostIp}, image, parentScope.registryId).then(function (chunk) {
                                            if (!chunk.length) {
                                                image.processStatus = 'Download error';
                                            } else if (chunk.length === 1 && chunk[0].status === 'Pulling repository ' + $scope.name) {
                                                image.processStatus = 'Repository is empty';
                                            }
                                            if (image.processStatus === 'Download complete') {
                                                image.processStatus = 'Downloading complete';
                                            }
                                            image.processing = false;
                                            if (image.progressDetail) {
                                                delete image.progressDetail;
                                            }
                                            listAllImages(allImages);
                                        }, function (err) {
                                            findedImages.splice(0, 1);
                                            errorCallback(err);
                                        });
                                    };

                                    $scope.close = function () {
                                        window.jQuery('#tagSelect').select2('close');
                                        window.jQuery('#hostSelect').select2('close');
                                        dialog.close();
                                    };
                                }
                            });
                        };

                        $scope.findImages = function () {
                            $scope.pulling = false;
                            $scope.searching = true;
                            $scope.showResult = false;
                            registry = $scope.registryId;

                            if (!registry) {
                                $scope.searching = false;
                                $scope.showResult = true;
                                return;
                            }

                            var updateImages = function (err, images) {
                                $scope.findedImages = (images && images.results) || [];
                                $scope.searching = false;
                                $scope.showResult = true;
                            };

                            Docker.searchImage(registry, $scope.term).then(updateImages.bind(null, null), updateImages);
                        };

                        $scope.gridOrder = ['-star_count'];
                        $scope.gridProps = [
                            {
                                id: 'name',
                                name: 'Name',
                                sequence: 1,
                                active: true
                            },
                            {
                                id: 'star_count',
                                name: 'Stars',
                                sequence: 2,
                                active: true
                            },
                            {
                                id: 'is_official',
                                name: 'Official',
                                sequence: 3,
                                active: true
                            },
                            {
                                id: 'description',
                                name: 'description',
                                sequence: 4,
                                active: false
                            },
                            {
                                id: 'is_trusted',
                                name: 'Trusted',
                                sequence: 5,
                                active: true
                            },
                            {
                                id: '',
                                name: 'Action',
                                sequence: 6,
                                active: true,
                                type: 'button',
                                btn: {
                                    label: 'Pull',
                                    getClass: function () {
                                        return 'btn grid-mini-btn effect-orange-button';
                                    },
                                    action: function (object) {
                                        $scope.pullImage(object);
                                    },
                                    disabled: function (object) {
                                        return object.processing || $scope.pulling;
                                    }
                                }
                            },
                            {
                                id: '',
                                name: 'Process',
                                sequence: 7,
                                active: true,
                                type: 'progress',
                                _inProgress: function (object) {
                                    return object.processing;
                                },
                                _progressBar: function (object) {
                                    return object.progressDetail;
                                },
                                _getter: function (object) {
                                    return object.processStatus;
                                }
                            }
                        ];

                        $scope.exportFields = {
                            ignore: []
                        };

                        $scope.pullImage = function (image) {
                            var parentScope = $scope;
                            PopupDialog.custom({
                                templateUrl: 'docker/static/partials/select-tag.html',
                                openCtrl: function ($scope, dialog, Docker) {
                                    $scope.name = image.name;
                                    $q.all([
                                        $q.when(Docker.listHosts()),
                                        $q.when(Docker.getImageTags(registry, $scope.name))
                                    ]).then(function (result) {
                                        $scope.hosts = result[0] || [];
                                        $scope.tags = result[1] || [];
                                        if (!Array.isArray($scope.tags)) {
                                            var tagsArr = [];
                                            for (var tagKey in $scope.tags) {
                                                tagsArr.push({name: tagKey});
                                            }
                                            $scope.tags = tagsArr;
                                        }
                                        $scope.tags.push({name: 'all'});
                                    });

                                    $scope.allowedIP = allowedIP($scope);
                                    $scope.pullImage = function () {
                                        if (!$scope.tag) {
                                            return false;
                                        }
                                        $scope.close();
                                        image.tag = $scope.tag === 'all' ? '' : $scope.tag;
                                        image.processing = true;
                                        image.processStatus = "Preparing";

                                        setRegistryHost(parentScope, image);

                                        Docker.pullImage({primaryIp: $scope.hostIp}, image, parentScope.registryId).then(function (chunk) {
                                            if (!chunk.length) {
                                                image.processStatus = 'Download error';
                                            }
                                            if (image.processStatus === 'Download complete') {
                                                image.processStatus = 'Downloading complete';
                                            }
                                            image.processing = false;
                                            if (image.progressDetail) {
                                                delete image.progressDetail;
                                            }
                                            listAllImages(allImages);
                                        }, errorCallback);
                                    };

                                    $scope.close = function () {
                                        window.jQuery('#tagSelect').select2('close');
                                        window.jQuery('#hostSelect').select2('close');
                                        dialog.close();
                                    };
                                }
                            });
                        };

                        $scope.close = function () {
                            pullDialogOpeningStatus(false);
                            window.jQuery('#registrySelect').select2('close');
                            dialog.close();
                        };
                    };

                    return PopupDialog.custom({
                        templateUrl: 'docker/static/partials/find-images.html',
                        openCtrl: findImagesCtrl
                    });
                };


                $scope.$on('gridViewChangeTab', function (event, tab) {
                    $scope.tab = tab;
                    if (tab === 'all' && !allImages) {
                        allImages = true;
                        $scope.loading = true;
                        $scope.images = [];
                        listAllImages(true);
                    }
                });

            }
        ]);
}(window.JP.getModule('docker')));