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
            'Storage',
            '$location',
            '$filter',
            'util',
            'Account',
            'dockerPullImage',
            function ($scope, requestContext, localization, Docker, $q, PopupDialog, Storage, $location, $filter, util, Account, dockerPullImage) {
                localization.bind('docker', $scope);
                var CURRENT_PAGE_ACTION = 'docker.images';
                requestContext.setUpRenderContext(CURRENT_PAGE_ACTION, $scope, {
                    title: localization.translate(null, 'docker', 'See my Joyent Docker Images')
                });

                var hostId = requestContext.getParam('host') || '';
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
                        groupedImages.forEach(function (groupedImage) {
                            if (origImage.Id === groupedImage.Id) {
                                if (!groupedImage.hostIds) {
                                    groupedImage.hostIds = [groupedImage.hostId];
                                }
                                if (!groupedImage.hostNames) {
                                    groupedImage.hostNames = [groupedImage.hostName];
                                }
                                if (groupedImage.hostIds.indexOf(origImage.hostId) === -1) {
                                    groupedImage.hostIds.push(origImage.hostId);
                                }
                                if (groupedImage.hostNames.indexOf(origImage.hostName) === -1) {
                                    groupedImage.hostNames.push(origImage.hostName);
                                }
                                if (origImage.ParentId) {
                                    groupedImage.ParentId = origImage.ParentId;
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
                    $q.all([
                        Docker.listAllImages(all ? {all: true, cache: true} : {cache: true}),
                        Docker.listHosts({prohibited: true})
                    ]).then(function (result) {
                        var images = result[0] || [];
                        var hosts = result[1] || [];
                        images = images.filter(function (image) {
                            if (image.suppressErrors) {
                                $scope.unreachableHosts = image.suppressErrors;
                            }
                            return !image.suppressErrors && (!hostId || hostId === image.hostId);
                        });
                        $scope.imagesFilter = Docker.getHostFilter(hostId, hosts);
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
                        _getter: function (image) {
                            var html = [];
                            if (!image.hostIds) {
                                html = image.hostName;
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
                        active: true,
                        exportGetter: true,
                        _getter: function (image) {
                            return image.isSdc ? 'N/A' : image.hostId;
                        }
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
                            if (image.hostIds && image.hostIds.length) {
                                groupingImages = imagesWithoutGrouping.filter(function (item) {
                                    return item.ParentId === image.ParentId && item.hostId !== image.hostId;
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
                                if (action === 'remove') {
                                    image.isRemoving = true;
                                    if (!image.isSdc && image.RepoTags && image.RepoTags.length > 0) {
                                        currentAction = 'forceRemove';
                                        currentData = {host: {primaryIp: image.primaryIp, id: image.hostId}, options: {id: image.Id}};
                                    }
                                }
                                Docker[currentAction + 'Image'](currentData).then(function (response) {
                                    deferred.resolve(response);
                                }, function (err) {
                                    deferred.reject(err);
                                    image.actionInProgress = false;
                                    image.checked = false;
                                    if (image.isRemoving) {
                                        delete image.isRemoving;
                                    }
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
                    ignore: ['Size']
                };
                $scope.searchForm = true;
                $scope.enabledCheckboxes = true;
                $scope.placeHolderText = 'filter images';
                $scope.tabFilterField = 'images';

                var activeTab = requestContext.getParam('tab');
                if (activeTab) {
                    $scope.tabFilterDefault = activeTab;
                }

                Storage.pingManta(function () {
                    listAllImages();
                });

                $scope.createImage = function () {
                    $location.path('/docker/image/create');
                };

                function pullDialogOpeningStatus(status) {
                    $scope.pullDialogOpening = status;
                }

                //search images
                $scope.searchImages = function () {
                    $scope.pullDialogOpening = true;
                    dockerPullImage(undefined, $scope.unreachableHosts, undefined, pullDialogOpeningStatus, function() {
                        listAllImages(allImages);
                    });
                };

                $scope.$on('$routeChangeSuccess', function(next, current) {
                    if (current.$$route.action === CURRENT_PAGE_ACTION) {
                        hostId = requestContext.getParam('host') || '';
                        $scope.tabFilterUpdate = 'top';
                        allImages = false;
                        listAllImages();
                    }
                });

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
