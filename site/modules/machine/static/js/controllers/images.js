'use strict';

(function (ng, app) {
    app.controller('Machine.ImagesController', [
        '$scope',
        '$cookieStore',
        '$filter',
        '$$track',
        '$dialog',
        '$q',
        'requestContext',
        'Image',
        'localization',
        'util',
        '$http',

        function ($scope, $cookieStore, $filter, $$track, $dialog, $q, requestContext, Image, localization, util, $http) {
            localization.bind('machine', $scope);
            requestContext.setUpRenderContext('machine.images', $scope, {
                title: localization.translate(null, 'machine', 'Image List')
            });

            $scope.imagesJob = Image.image(true);
            $scope.loading = true;
            $scope.images = [];

            $q.when($scope.imagesJob).then(
                function (data) {
                    // TODO: images promise logic should be like machines
                    $scope.images.push.apply($scope.images, data);
                    $scope.loading = false;
                }
            );

            $scope.$on(
                'event:forceUpdate',
                function () {
                    $scope.imagesJob = Image.image(true);
                    $q.when($scope.imagesJob).then(
                        function (data) {
                            $scope.images = [];
                            // TODO: images promise logic should be like machines
                            $scope.images.push.apply($scope.images, data);
                            $scope.search();
                            $scope.loading = false;
                        }
                    );
                }
            );

            $scope.clickDelete = function (image) {
                util.confirm(
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


            $scope.gridOrder = [];
            $scope.gridProps = [
                {
                    id: 'name',
                    name: 'Name',
                    sequence: 1
                },
                {
                    id: 'description',
                    name: 'Description',
                    sequence: 2
                },
                {
                    id: 'version',
                    name: 'Version',
                    sequence: 3
                },
                {
                    id: 'published_at',
                    name: 'Published at',
                    sequence: 4
                },
                {
                    id: 'state',
                    name: 'State',
                    sequence: 5
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
                    disabled: function (object) {
                        return false;
                    },
                    action: function (object) {
                        $scope.clickDelete(object);
                    },
                    show: function (object) {
                        return !object.public;
                    },
                    tooltip: 'You will not be able to create any instances with this image after this.',
                    sequence: 1
                }
            ];

            $scope.exportFields = {
                ignore: []
            };

        }
    ]);
}(window.angular, window.JP.getModule('Machine')));
