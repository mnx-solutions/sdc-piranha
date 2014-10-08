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

                $scope.loading = true;

                var errorCallback = function (err) {
                    $scope.loading = false;
                    PopupDialog.errorObj(err);
                };

                if ($scope.features.manta === 'enabled') {
                    $scope.gridUserConfig = Account.getUserConfig().$child('docker-images');
                }

                var listAllImages = function () {
                    Docker.listAllImages().then(function (images) {
                        $scope.images = images.map(function (image) {
                            image.Id = image.Id.slice(0, 12);
                            return image;
                        });
                        $scope.loading = false;
                    }, errorCallback);
                };

                $scope.gridOrder = ['-Created'];
                $scope.gridProps = [
                    {
                        id: 'hostName',
                        name: 'Host',
                        sequence: 1,
                        active: true
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
                        id: 'Id',
                        name: 'Image ID',
                        sequence: 4,
                        active: true
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

                function makeImageAction(action, messageTitle, messageBody) {
                    if ($scope.checkedItems.length) {
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
                                    messageBody[$scope.checkedItems.length > 1 ? 'plural' : 'single']
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
                        sequence: 1
                    }
                ];

                $scope.exportFields = {
                    ignore: []
                };
                $scope.searchForm = true;
                $scope.enabledCheckboxes = true;
                $scope.placeHolderText = 'filter images';


                listAllImages();

                $scope.createImage = function () {
                    $location.path('/docker/image/create');
                };

                //search images
                $scope.searchImages = function () {

                    var findImagesCtrl = function ($scope, dialog, Docker) {
                        $scope.term = '';
                        $scope.loading = true;
                        $scope.searching = false;
                        Docker.listHosts().then(function (hosts) {
                            $scope.hosts = hosts || [];
                            $scope.loading = false;
                        });

                        $scope.findImages = function () {
                            $scope.searching = true;
                            $scope.showResult = false;
                            Docker.searchImage({primaryIp: $scope.hostIp}, $scope.term).then(function (images) {
                                $scope.findedImages = images || [];
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
                            var hostIp = $scope.hostIp;
                            PopupDialog.custom({
                                templateUrl: 'docker/static/partials/select-tag.html',
                                openCtrl: function ($scope, dialog, Docker) {
                                    $scope.name = image.name;
                                    Docker.getImageTags(image.name).then(function (tags) {
                                        $scope.tags = tags;
                                        tags.push({name: 'all'});
                                    });

                                    $scope.pullImage = function () {
                                        if (!$scope.tag) {
                                            return false;
                                        }
                                        $scope.close();
                                        image.tag = $scope.tag === 'all' ? '' : $scope.tag;
                                        image.processing = true;
                                        image.processStatus = "Preparing";
                                        Docker.pullImage({primaryIp: hostIp}, image).then(function () {
                                            image.processing = false;
                                            image.processStatus = "Downloading complete";
                                            if (image.progressDetail) {
                                                delete image.progressDetail;
                                            }
                                            listAllImages();
                                        }, errorCallback);
                                    };

                                    $scope.close = function () {
                                        window.jQuery('#tagSelect').select2('close');
                                        dialog.close();
                                    };
                                }
                            });
                        };

                        $scope.close = function () {
                            window.jQuery('#hostSelect').select2('close');
                            dialog.close();
                        };
                    };

                    return PopupDialog.custom({
                        templateUrl: 'docker/static/partials/find-images.html',
                        openCtrl: findImagesCtrl
                    });
                };

            }
        ]);
}(window.JP.getModule('docker')));