'use strict';

(function (app) {
    app.controller('Machine.ImagesController', [
        '$scope',
        '$$track',
        'requestContext',
        'Image',
        'localization',
        'PopupDialog',
        '$location',
        'Account',
        '$rootScope',

        function ($scope, $$track, requestContext, Image, localization, PopupDialog, $location, Account, $rootScope) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.images', $scope, {
                title: localization.translate(null, 'machine', 'Image List')
            });

            $scope.loading = true;
            var loadListImages = function () {
                Image.image().then(function (data) {
                    $scope.images = data;
                    $scope.loading = false;
                }, function (err) {
                    PopupDialog.errorObj(err);
                    $scope.images = [];
                    $scope.loading = false;
                });
            };

            loadListImages();

            $scope.clickDelete = function (image) {
                PopupDialog.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Delete image'
                    ),
                    localization.translate(
                        $scope,
                        'machine',
                        'Are you sure you want to delete this image?'
                    ), function () {
                        $$track.event('image', 'delete');
                        $scope.imageJob = Image.deleteImage(image);
                    });
            };

            $scope.provisionInstance = function (image) {
                $location.path('/compute/create/' + image.id);
            };

            if ($scope.features.manta === 'enabled') {
                $scope.gridUserConfig = Account.getUserConfig().$child('images');
            }

            $scope.gridOrder = ['-published_at'];
            $scope.gridProps = [
                {
                    id: 'name',
                    name: 'Name',
                    _order: 'name',
                    sequence: 1,
                    active: true,
                    type: 'html',
                    _getter: function (object) {
                        return '<a href="#!/images/' + object.id + '">' + object.name + '</a>';
                    }

                },
                {
                    id: 'description',
                    name: 'Description',
                    sequence: 2,
                    active: true,
                    columnClass: 'description-column'
                },
                {
                    id: 'os',
                    name: 'OS',
                    sequence: 3,
                    active: true
                },
                {
                    id: 'published_at',
                    name: 'Published at',
                    type: 'date',
                    sequence: 4,
                    active: true,
                    reverseSort: true
                },
                {
                    id: 'state',
                    name: 'State',
                    sequence: 5,
                    active: true
                },
                {
                    id: 'parsed',
                    name: 'Action',
                    type: 'button',
                    sequence: 6,
                    active: true,
                    btn: {
                        label: 'Create instance',
                        disabled: function (object) {
                            return object.job && !object.job.finished;
                        },
                        action: function (object) {
                            $scope.provisionInstance(object);
                        },
                        getClass: function () {
                            return 'grid-small-font btn button ci btn-edit effect-orange-button';
                        }
                    }
                },
                {
                    id: 'datacenter',
                    name: 'Data Center',
                    sequence: 7,
                    active: false
                },
                {
                    id: 'version',
                    name: 'Version',
                    sequence: 8,
                    active: false
                },
                {
                    id: 'id',
                    name: 'UUID',
                    sequence: 9,
                    active: false
                }
            ];
            $scope.gridDetailProps = [
                {
                    id: 'id',
                    name: 'UUID',
                    sequence: 1
                },
                {
                    id: 'os',
                    name: 'OS',
                    sequence: 2
                },
                {
                    id: 'description',
                    name: 'Description',
                    sequence: 3
                },
                {
                    id: 'public',
                    name: "Public",
                    sequence: 4
                }
            ];

            $scope.gridActionButtons = [
                {
                    label: 'Delete',
                    action: function () {
                        if ($scope.checkedImages.length > 0) {
                            PopupDialog.confirm(
                                localization.translate(
                                    $scope,
                                    null,
                                    'Confirm: Delete images'
                                ),
                                localization.translate(
                                    $scope,
                                    null,
                                    'Are you sure you want to delete {{image}}?',
                                    {image: $scope.checkedImages.length === 1 ? 'this image' : 'these images'}
                                ), function () {
                                    $scope.checkedImages.forEach(function (image) {
                                        $$track.event('image', 'delete');

                                        Image.deleteImage(image).promise.then(function () {
                                            if (requestContext.getParam('currentImage') === image.id) {
                                                $location.url('/images');
                                                $location.replace();
                                            }
                                        });
                                        image.checked = false;
                                        $scope.checkedImages = [];
                                    });
                                }
                            );
                        } else {
                            PopupDialog.noItemsSelectedError('image');
                        }
                    },
                    sequence: 1
                }
            ];

            $scope.exportFields = {
                ignore: ['Action']
            };

            $scope.columnsButton = true;
            $scope.imageButtonShow = true;
            $scope.imgForm = true;
            $scope.searchForm = true;
            $scope.placeHolderText = 'filter images';

            $scope.tabFilterField = 'datacenter';
            $scope.tabFilterDefault = $rootScope.commonConfig($scope.tabFilterField);
            $scope.$on('gridViewChangeTab', function (event, tab) {
                if (tab === 'all') {
                    $rootScope.clearCommonConfig($scope.tabFilterField);
                } else {
                    $rootScope.commonConfig($scope.tabFilterField, tab);
                }
            });
        }
    ]);
}(window.JP.getModule('Machine')));
