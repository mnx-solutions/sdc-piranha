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
                title: localization.translate(null, 'machine', 'My images')
            });

            $scope.imagePromise = Image.image(true);
            $scope.loading = true;
            $scope.images = [];

            $q.when($scope.imagePromise).then(
                function (data) {
                    // TODO: images promise logic should be like machines
                    $scope.images.push.apply($scope.images, data);
                    $scope.loading = false;
                }
            );

            $scope.$on(
                'event:forceUpdate',
                function () {
                    $scope.image = Image.image(true);
                    $scope.loading = false;
                }
            );

            $scope.clickDelete = function (image) {
                util.confirm(
                    localization.translate(
                        $scope,
                        null,
                        'Confirm: Delete image'
                    ), function () {
                        $$track.event('image', 'delete');
                        Image.deleteImage(image);
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
                    id: 'version',
                    name: 'Version',
                    sequence: 2
                },
                {
                    id: 'published_at',
                    name: 'Published at',
                    sequence: 3
                },
                {
                    id: 'state',
                    name: 'State',
                    sequence: 4
                }
            ];
            $scope.gridDetailProps = [
                {
                    id: 'os',
                    name: 'OS',
                    sequence: 1
                },
                {
                    id: 'description',
                    name: 'Description',
                    sequence: 2
                },
                {
                    id: 'public',
                    name: "Public",
                    sequence: 3
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
