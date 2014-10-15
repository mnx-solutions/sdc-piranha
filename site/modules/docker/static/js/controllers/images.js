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

                var errorCallback = function (err) {
                    $scope.loading = false;
                    PopupDialog.errorObj(err);
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
                                grImage.hostIds.push(origImage.hostId);
                                grImage.hostNames.push(origImage.hostName);
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
                    Docker.listAllImages(all ? {all: true} : null).then(function (images) {
                        images.forEach(function (image) {
                            image.Id = image.Id.slice(0, 12);
                            if (all) {
                                image.images = topImages.indexOf(image.Id) === -1 ? 'all' : 'top';
                            } else {
                                image.images = 'top';
                                topImages.push(image.Id);
                            }
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
                                html = '<a href="#!/docker/image/' + image.hostId + '/' + image.Id + '" style="min-width: 140px;">' + image.Id + '</a>';
                            } else {
                                html = '<span>' + image.Id + '</span>';
                            }
                            return html;
                        }
                    },
                    {
                        id: 'repository',
                        name: 'Repository',
                        _order: 'repo',
                        sequence: 2,
                        active: true,
                        type: 'progress',
                        _inProgress: function (image) {
                            return image.actionInProgress;
                        },
                        _getter: function (image) {
                            return image.RepoTags[0].split(':')[0];
                        }
                    },
                    {
                        id: 'tag',
                        name: 'Tag',
                        sequence: 3,
                        active: true,
                        type: 'html',
                        _getter: function (image) {
                            return image.RepoTags[0].split(':')[1];
                        }
                    },
                    {
                        id: 'hostName',
                        name: 'Host',
                        sequence: 4,
                        active: true,
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
                    }
                ];

                var gridMessages = {
                    remove: {
                        single: 'Please confirm that you want to remove this image.',
                        plural: 'Please confirm that you want to remove selected images.'
                    }
                };

                function makeImageAction (action, messageTitle, messageBody) {
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
                                image.checked = true;
                                var deferred = $q.defer();
                                Docker[action + 'Image'](image).then(function (response) {
                                    deferred.resolve(response);
                                    image.actionInProgress = false;
                                    image.checked = false;
                                }, function (err) {
                                    deferred.reject(err);
                                    image.actionInProgress = false;
                                    image.checked = false;
                                    errorCallback(err);
                                });
                                promises.push(deferred.promise);
                            });

                            $q.all(promises).then(function () {
                                $scope.checkedItems = [];
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
                                ), actionFunction
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
                        ), function () {
                        }
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


                listAllImages();

                $scope.createImage = function () {
                    $location.path('/docker/image/create');
                };

                //search images
                $scope.searchImages = function () {

                    var findImagesCtrl = function ($scope, dialog, Docker) {
                        var registry;
                        $scope.term = '';
                        $scope.loading = true;
                        $scope.searching = false;
                        Docker.getRegistriesList().then(function (list) {
                            $scope.registries = list || [];
                            $scope.loading = false;
                        });

                        $scope.findImages = function () {
                            $scope.searching = true;
                            $scope.showResult = false;
                            registry = $scope.registryId;
                            if (!registry) {
                                $scope.searching = false;
                                $scope.showResult = true;
                                return;
                            }

                            Docker.searchImage(registry, $scope.term).then(function (images) {
                                $scope.findedImages = (images && images.results) || [];
                                $scope.searching = false;
                                $scope.showResult = true;
                            }, function () {
                                $scope.searching = false;
                                $scope.showResult = true;
                            });
                        };

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
                                        return object.processing;
                                    }
                                }
                            },
                            {
                                id: '',
                                name: 'Process',
                                sequence:7,
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
                                },
                            }
                        ];

                        $scope.exportFields = {
                            ignore: []
                        };

                        $scope.pullImage = function (image) {
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
                                        $scope.tags.push({name: 'all'});
                                    });

                                    $scope.pullImage = function () {
                                        if (!$scope.tag) {
                                            return false;
                                        }
                                        $scope.close();
                                        image.tag = $scope.tag === 'all' ? '' : $scope.tag;
                                        image.processing = true;
                                        image.processStatus = "Preparing";
                                        Docker.pullImage({primaryIp: $scope.hostIp}, image).then(function () {
                                            image.processing = false;
                                            image.processStatus = "Downloading complete";
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