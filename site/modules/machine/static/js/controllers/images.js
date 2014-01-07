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
        '$location',

        function ($scope, $cookieStore, $filter, $$track, $dialog, $q, requestContext, Image, localization, util, $http, $location) {
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
                    id: 'datacenter',
                    name: 'Data Center',
                    sequence: 2,
                    active: true
                },
                {
                    id: 'version',
                    name: 'Version',
                    sequence: 3,
                    active: true
                },
                {
                    id: 'published_at',
                    name: 'Published at',
                    sequence: 4,
                    active: true
                },
                {
                    id: 'state',
                    name: 'State',
                    sequence: 5,
                    active: true,
                    btn: {
                        label: 'Create instance',
                        disabled: function (object) {
                            return object.job;
                        },
                        action: function (object) {
                            $scope.provisionInstance(object);
                        }
                    }
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
                    id: 'datacenter',
                    name: 'Datacenter',
                    sequence: 4
                },
                {
                    id: 'public',
                    name: "Public",
                    sequence: 5
                }
            ];

            $scope.gridActionButtons = [
                {
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
                        return 'btn orange';
                    },
                    sequence: 1

                }/*,
                {
                    label: 'Delete',
                    disabled: function (object) {
                        return object.job;
                    },
                    action: function (object) {
                        $scope.clickDelete(object);
                    },
                    show: function (object) {
                        return !object.public;
                    },
                    tooltip: 'You will not be able to create any instances with this image after this.',
                    sequence: 2
                }*/
            ];

            $scope.exportFields = {
                ignore: []
            };
            $scope.columnsButton = true;
            $scope.imageButtonShow = true;
            $scope.imgForm = true;
            $scope.instForm = true;
            $scope.placeHolderText = 'filter images';



//            $scope.actionsButton = true;
//            $scope.enabledCheckboxes = true;

//            $scope.actionButton = function(){
//                var flag = false;
//                $scope.images.forEach(function (el) {
//                    if(el.checked){
//                        flag = true;
//                    }
//                });
//                return flag;
//            };
//
//            $scope.noCheckBoxChecked = function(){
//                util.error(
//                    localization.translate(
//                        $scope,
//                        null,
//                        'Error'
//                    ),
//                    localization.translate(
//                        $scope,
//                        null,
//                        'No image selected for the action.'
//                    ), function () {
//                    }
//                );
//            };

        }
    ]);
}(window.angular, window.JP.getModule('Machine')));
