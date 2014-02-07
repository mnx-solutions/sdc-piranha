'use strict';

(function (ng, app) {
    app.controller('Machine.ImagesController', [
        '$scope',
        '$cookieStore',
        '$filter',
        '$$track',
        '$q',
        'requestContext',
        'Image',
        'localization',
        'PopupDialog',
        '$http',
        '$location',

        function ($scope, $cookieStore, $filter, $$track, $q, requestContext, Image, localization, PopupDialog, $http, $location) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.images', $scope, {
                title: localization.translate(null, 'machine', 'Image List')
            });

            $scope.loading = true;

            $scope.$watch('images.final', function (final) {
                if(final) {
                    $scope.loading = false;
                }
            });

            $scope.$on(
                'event:forceUpdate',
                function () {
                    $scope.images = Image.image(true);
                }
            );

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
                        'Are you sure you want to delete this image'
                    ), function () {
                        $$track.event('image', 'delete');
                        $scope.imageJob = Image.deleteImage(image);
                    });
            };

            $scope.provisionInstance = function(image) {
                $location.path('/compute/create/'+ image.id);
            };


            $scope.gridOrder = [];
            $scope.gridProps = [
                {
                    id: 'name',
                    name: 'Name',
                    sequence: 1,
                    active: true
                },
                {
                    id: 'description',
                    name: 'Description',
                    sequence: 2,
                    active: true
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
                    sequence: 4,
                    _getter: function (image) {
                        return $filter('date')(new Date(image.published_at), 'yyyy-MM-dd HH:mm');
                    },
                    active: true
                },
                {
                    id: 'parsed',
                    name: 'Action',
                    type: 'button',
                    sequence: 5,
                    active: true,
                    btn: {
                        label: 'Create instance',
                        disabled: function (object) {
                            return object.job;
                        },
                        action: function (object) {
                            $scope.provisionInstance(object);
                        },

                        show: function (object) {
                            return true;
                        },
                        getClass: function () {
                            return 'btn orange font-size-12 ci';
                        }
                    }
                },
                {
                    id: 'datacenter',
                    name: 'Data Center',
                    sequence: 6,
                    active: false
                },
                {
                    id: 'version',
                    name: 'Version',
                    sequence: 7,
                    active: false
                },
                {
                    id: 'id',
                    name: 'UUID',
                    sequence: 8,
                    active: false
                },
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

            $scope.exportFields = {
                ignore: []
            };
            $scope.columnsButton = true;
            $scope.imageButtonShow = true;
            $scope.imgForm = true;
            $scope.instForm = true;
            $scope.placeHolderText = 'filter images';
        }
    ]);
}(window.angular, window.JP.getModule('Machine')));
