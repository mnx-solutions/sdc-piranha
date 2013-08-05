'use strict';

(function (app) {
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

            $scope.images = Image.image(true);
            $scope.loading = true;

            $q.when($scope.images).then(
                function () {
                    console.log($scope.images);
                    $scope.loading = false;
                }
            );


        }
    ])
}(window.JP.getModule('Machine')));