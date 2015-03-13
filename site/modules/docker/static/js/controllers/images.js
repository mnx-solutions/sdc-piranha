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
                $scope.unreachableHosts = [];
                $scope.loading = true;
                $scope.pullDialogOpening = false;
                $scope.showGraph = false;

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
                        images = images.filter(function (image) {
                            if (image.suppressErrors) {
                                $scope.unreachableHosts = image.suppressErrors;
                            }
                            return !image.suppressErrors;
                        });
                        images.forEach(function (image) {
                            image.ShorId = image.Id.slice(0, 12);
                            if (all) {
                                image.images = topImages.indexOf(image.ShorId) === -1 ? 'all' : 'top';
                            } else {
                                image.images = 'top';
                                topImages.push(image.ShorId);
                            }
                            image.repository = image.RepoTags && image.RepoTags.length ? image.RepoTags[0].split(':')[0] : '';
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
                        type: 'popover'
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
                            var html = [];
                            if (!image.hostIds) {
                                html = '<span>' + image.hostName + '</span>';
                            } else {
                                image.hostIds.forEach(function (hostId, index) {
                                    html.push(image.hostNames[index]);
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
                        entryType: Number,
                        _order: 'VirtualSize',
                        _getter: function (image) {
                            return util.getReadableFileSizeString(image.VirtualSize);
                        }
                    },
                    {
                        id: 'hostId',
                        name: 'Host ID',
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
                    PopupDialog.noItemsSelectedError('images');
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

                function getHosts(scope) {
                    var selectedRegistry = getSelectedRegistry(scope);
                    return Docker[selectedRegistry && selectedRegistry.type === 'local' ? 'listRunningPrivateRegistryHosts' : 'completedHosts']()
                }

                function removeUnreachableHosts(hosts) {
                    if ($scope.unreachableHosts.length > 0) {
                        hosts = hosts.filter(function (host) {
                            return $scope.unreachableHosts.every(function (error) {
                                return error.indexOf(host.primaryIp) === -1;
                            });
                        });
                    }
                    return hosts;
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
                            $scope.registries = Docker.addRegistryUsernames($scope.registries);
                            pullDialogOpeningStatus(false);
                            $scope.registryId = $scope.registries[0].id || null;
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
                            var foundImages =  $scope.foundImages = [];
                            var parentScope = $scope;
                            $scope.pulling = true;
                            PopupDialog.custom({
                                templateUrl: 'docker/static/partials/select-tag.html',
                                openCtrl: function ($scope, dialog, Docker) {
                                    $scope.name = image.name;
                                    $scope.tag = 'all';
                                    $scope.hideTags = true;
                                    $scope.loading = true;
                                    getHosts(parentScope).then(function (hosts) {
                                        $scope.hosts = hosts && hosts.length ? removeUnreachableHosts(hosts) : [];
                                        $scope.loading = false;
                                    });
                                    $scope.selectedHosts = [];
                                    $scope.allowedIP = allowedIP($scope);
                                    $scope.pullImage = function () {
                                        foundImages.push(image);
                                        image.pullProcesses = {};
                                        $scope.close();

                                        setRegistryHost(parentScope, image);
                                        $scope.selectedHosts.forEach(function (selectedHost) {
                                            var host = Docker.getHost($scope.hosts, selectedHost.primaryIp);
                                            image.pullProcesses[host.id] = {
                                                host: host,
                                                processing: true,
                                                processStatus: 'Preparing'
                                            };
                                            Docker.pullImage(host, image, parentScope.registryId).then(function (chunk) {
                                                if (!chunk.length || !host.id) {
                                                    image.pullProcesses[host.id].processStatus = 'Download error';
                                                } else if (chunk.length === 1 && chunk[0].status === 'Pulling repository ' + $scope.name) {
                                                    image.pullProcesses[host.id].processStatus = 'Repository is empty';
                                                }
                                                if (image.pullProcesses[host.id].processStatus === 'Download complete') {
                                                    image.pullProcesses[host.id].processStatus = 'Downloading complete';
                                                }
                                                image.pullProcesses[host.id].processing = false;
                                                if (image.pullProcesses[host.id].progressDetail) {
                                                    delete image.pullProcesses[host.id].progressDetail;
                                                }
                                                listAllImages(allImages);
                                            }, function (err) {
                                                foundImages.splice(0, 1);
                                                if (!err.message) {
                                                    if (err.statusCode === 404) {
                                                        err.message = 'Image not found';
                                                    } else if (err.statusCode === 400 || err.statusCode === 500) {
                                                        err.message = 'Wrong image name';
                                                    } else if (err.code === 'EHOSTUNREACH' || err.code === 'ETIMEDOUT') {
                                                        err.message = 'Docker host "' + (host.name || host.primaryIp) + '" is unreachable.';
                                                    }
                                                }
                                                image.processing = false;
                                                image.processStatus = '';
                                                errorCallback(err);
                                            });
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
                                if (err) {
                                    errorCallback(err);
                                }
                                $scope.foundImages = (images && images.results) || [];
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
                                name: 'Description',
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
                                        if (object.pullProcesses) {
                                            var processing = false;
                                            for (var key in object.pullProcesses) {
                                                if (object.pullProcesses[key].processing) {
                                                    processing = object.pullProcesses[key].processing;
                                                }
                                            }
                                            if (processing) {
                                                return processing;
                                            }
                                        }
                                        return $scope.pulling;
                                    }
                                }
                            },
                            {
                                id: '',
                                name: 'Process',
                                sequence: 7,
                                active: true,
                                type: 'multipleProgress',
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
                                    $scope.loading = true;
                                    $scope.name = image.name;
                                    $q.all([
                                        $q.when(getHosts(parentScope)),
                                        $q.when(Docker.getImageTags(registry, $scope.name))
                                    ]).then(function (result) {
                                        $scope.hosts = result[0] && result[0].length ? removeUnreachableHosts(result[0]) : [];
                                        $scope.tags = result[1] || [];
                                        $scope.tag = $scope.tags[0].name || null;
                                        $scope.tags.push({name: 'all'});
                                        $scope.loading = false;
                                    });

                                    $scope.allowedIP = allowedIP($scope);
                                    $scope.pullImage = function () {
                                        if (!$scope.tag) {
                                            return false;
                                        }
                                        $scope.close();
                                        image.tag = $scope.tag === 'all' ? '' : $scope.tag;

                                        setRegistryHost(parentScope, image);
                                        image.pullProcesses = {};
                                        $scope.selectedHosts.forEach(function (selectedHost) {
                                            var host = Docker.getHost($scope.hosts, selectedHost.primaryIp);
                                            image.pullProcesses[host.id] = {
                                                host: host,
                                                processing: true,
                                                processStatus: 'Preparing'
                                            };
                                            parentScope.processing = true;

                                            Docker.pullImage(host, image, parentScope.registryId).then(function (chunk) {
                                                if (!chunk.length) {
                                                    image.pullProcesses[host.id].processStatus = 'Download error';
                                                }
                                                if (image.pullProcesses[host.id].processStatus === 'Download complete') {
                                                    image.pullProcesses[host.id].processStatus = 'Downloading complete';
                                                }
                                                parentScope.processing = image.pullProcesses[host.id].processing = false;
                                                if (image.pullProcesses[host.id].progressDetail) {
                                                    delete image.pullProcesses[host.id].progressDetail;
                                                }
                                                listAllImages(allImages);
                                            }, errorCallback);
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
                    if (tab !== 'top' && !allImages) {
                        allImages = true;
                        $scope.loading = true;
                        $scope.images = [];
                        listAllImages(true);
                    }
                    if (tab === 'graph') {
                        $scope.showGraph = true;
                        window.jQuery('.grid-view-table, .grid-no-entries').hide();
                    } else {
                        $scope.showGraph = false;
                        window.jQuery('.grid-view-table, .grid-no-entries').show();
                    }
                });

            }
        ]);
}(window.JP.getModule('docker')));
